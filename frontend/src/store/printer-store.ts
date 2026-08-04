import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as qz from "@/lib/printer/qzClient";
import { PrinterError } from "@/lib/printer/qzClient";
import { buildEscPosReceipt, buildEscPosTestSlip, buildEscPosOrderReceipt, type ReceiptRestaurantInfo, type SingleOrderForPrint } from "@/lib/printer/escpos";
import { buildEscPosKOT, splitKOTItemsByPrinter, type KOTOrder, type KOTOrderItem, type KOTPrinterRole } from "@/lib/printer/kot";
import type { ReceiptData } from "@/lib/admin-api";

export type PrinterConnectionStatus = "idle" | "connecting" | "connected" | "error";
export type PrinterRole = "kitchen" | "counter";

/** Outcome of printing a KOT to both printers. Each side is reported
 *  independently — one printer failing (paper out, offline, unplugged)
 *  must never stop the KOT from reaching the other printer. */
export interface KotPrintResult {
  kitchen: { ok: true } | { ok: false; error: string };
  counter: { ok: true } | { ok: false; error: string };
}

interface PrinterStore {
  status: PrinterConnectionStatus;
  errorMessage: string | null;
  availablePrinters: string[];

  // ---- Printer Configuration ----
  // Windows queue names, chosen explicitly in Printer Settings — never
  // hardcoded or guessed by matching a model name.
  kitchenPrinter: string | null;
  counterPrinter: string | null;
  // When true, a loud alert sound plays on the dashboard the instant a
  // new order's Socket.IO event is received — independent of Auto Print
  // KOT above, so staff still get notified even with that switched off.
  autoPrintKot: boolean;
  orderAlertSoundEnabled: boolean;

  connect: () => Promise<void>;
  refreshPrinters: () => Promise<void>;
  setKitchenPrinter: (name: string | null) => void;
  setCounterPrinter: (name: string | null) => void;
  setAutoPrintKot: (enabled: boolean) => void;
  setOrderAlertSoundEnabled: (enabled: boolean) => void;

  // Bills/receipts print ONLY on the Counter Printer — the kitchen printer
  // must never receive a customer bill.
  printReceipt: (receipt: ReceiptData, width?: 58 | 80) => Promise<void>;
  printOrder: (order: SingleOrderForPrint, restaurant: ReceiptRestaurantInfo | null, width?: 58 | 80) => Promise<void>;

  // Each KOT line item routes to exactly one printer by category — food to
  // the Kitchen Printer, beverages to the Counter Printer (see
  // lib/printer/kot.ts). A mixed order prints two separate tickets; an
  // order with items for only one printer prints only that ticket.
  printKOT: (order: KOTOrder, width?: 58 | 80) => Promise<KotPrintResult>;

  testPrint: (role: PrinterRole, width?: 58 | 80) => Promise<void>;
}

/**
 * Resolves a configured printer role to an actual Windows queue name.
 * Falls back to the Windows default printer only when nothing has been
 * configured yet in Printer Settings — this never matches by a hardcoded
 * printer/model name.
 */
async function resolvePrinter(configured: string | null): Promise<string> {
  if (configured) return configured;
  const def = await qz.getDefaultPrinter();
  if (def) return def;
  throw new PrinterError(
    "PRINTER_NOT_FOUND",
    "No printer configured. Open Printer Settings and choose a printer."
  );
}

export const usePrinterStore = create<PrinterStore>()(
  persist(
    (set, get) => ({
      status: "idle",
      errorMessage: null,
      availablePrinters: [],
      kitchenPrinter: null,
      counterPrinter: null,
      autoPrintKot: true,
      orderAlertSoundEnabled: true,

      connect: async () => {
        set({ status: "connecting", errorMessage: null });
        try {
          await qz.connect();
          const printers = await qz.listPrinters();
          set({ status: "connected", availablePrinters: printers, errorMessage: null });
        } catch (err) {
          const message = err instanceof PrinterError ? err.message : "Could not connect to QZ Tray.";
          set({ status: "error", errorMessage: message });
        }
      },

      refreshPrinters: async () => {
        try {
          if (!(await qz.isConnected())) await qz.connect();
          const printers = await qz.listPrinters();
          set({ availablePrinters: printers, status: "connected", errorMessage: null });
        } catch (err) {
          const message = err instanceof PrinterError ? err.message : "Could not refresh printer list.";
          set({ status: "error", errorMessage: message });
        }
      },

      setKitchenPrinter: (name) => set({ kitchenPrinter: name }),
      setCounterPrinter: (name) => set({ counterPrinter: name }),
      setAutoPrintKot: (enabled) => set({ autoPrintKot: enabled }),
      setOrderAlertSoundEnabled: (enabled) => set({ orderAlertSoundEnabled: enabled }),

      printReceipt: async (receipt, width = 80) => {
        const printerName = await resolvePrinter(get().counterPrinter);
        const payload = await buildEscPosReceipt(receipt, width);
        await qz.printRaw(printerName, payload);
      },

      printOrder: async (order, restaurant, width = 80) => {
        const printerName = await resolvePrinter(get().counterPrinter);
        const payload = buildEscPosOrderReceipt(order, restaurant, width);
        await qz.printRaw(printerName, payload);
      },

      printKOT: async (order, width = 80) => {
        const { kitchen: kitchenItems, counter: counterItems } = splitKOTItemsByPrinter(order.items);
        const { kitchenPrinter, counterPrinter } = get();

        const printTo = async (
          configured: string | null,
          role: KOTPrinterRole,
          items: KOTOrderItem[]
        ): Promise<{ ok: true } | { ok: false; error: string }> => {
          // Nothing routed to this printer for this order (e.g. a
          // beverages-only order has no Kitchen items) — an all-beverage
          // order must produce only the Beverage Order Ticket, and vice
          // versa, so simply skip this printer rather than sending a blank
          // ticket or reporting a failure.
          if (items.length === 0) return { ok: true };
          try {
            const printerName = await resolvePrinter(configured);
            const payload = buildEscPosKOT(order, role, items, width);
            await qz.printRaw(printerName, payload);
            return { ok: true };
          } catch (err) {
            const message =
              err instanceof PrinterError ? err.message : err instanceof Error ? err.message : "Print failed.";
            return { ok: false, error: message };
          }
        };

        // Fired concurrently and independently: a failure on one printer
        // (e.g. Kitchen Printer offline) must never block or cancel the
        // print job on the other (e.g. Counter Printer still gets its copy).
        const [kitchen, counter] = await Promise.all([
          printTo(kitchenPrinter, "kitchen", kitchenItems),
          printTo(counterPrinter, "counter", counterItems),
        ]);

        return { kitchen, counter };
      },

      testPrint: async (role, width = 80) => {
        const configured = role === "kitchen" ? get().kitchenPrinter : get().counterPrinter;
        const printerName = await resolvePrinter(configured);
        const payload = buildEscPosTestSlip(printerName, width);
        await qz.printRaw(printerName, payload);
      },
    }),
    {
      name: "denova-admin-printer",
      // Printer configuration survives a refresh; live connection status
      // and the discovered printer list are always re-derived on load.
      partialize: (s) => ({
        kitchenPrinter: s.kitchenPrinter,
        counterPrinter: s.counterPrinter,
        autoPrintKot: s.autoPrintKot,
        orderAlertSoundEnabled: s.orderAlertSoundEnabled,
      }),
    }
  )
);

export { PrinterError };