"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { usePrinterStore } from "@/store/printer-store";
import { RESTAURANT_ID } from "@/constants/restaurant";
import type { Order } from "@/types/order";
import type { KOTOrder } from "@/lib/printer/kot";
import { playOrderAlertSound, unlockOrderAlertAudio } from "@/lib/printer/orderAlertSound";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

// How often to re-check the QZ Tray connection while auto-print is armed,
// so a printer that goes offline mid-shift is noticed without anyone
// having to open Printer Settings.
const CONNECTION_POLL_MS = 20000;

// How long a "KOT printed" success toast stays up before clearing itself.
const SUCCESS_TOAST_MS = 4000;

/**
 * KOTService — the automatic-printing counterpart to PrinterProvider.
 *
 * This is the sole replacement for the old Kitchen Display System's manual
 * "Print KOT" button. Mounted once in the admin dashboard layout, it:
 *   1. Joins this restaurant's `kitchen:<restaurantId>` Socket.IO room
 *      (the same room the KDS used to join).
 *   2. Listens for the backend's existing "new-order" event.
 *   3. The instant an order arrives, prints a Kitchen Order Ticket on both
 *      configured printers automatically — no popup, no browser print
 *      dialog, no confirmation, no button click.
 *
 * As long as the admin app is open (on any page), every new order is
 * printed the moment it's placed. If QZ Tray isn't reachable, a banner
 * says so instead of failing silently.
 */
export default function KotAutoPrintProvider({ children }: { children: React.ReactNode }) {
  const autoPrintKot = usePrinterStore((s) => s.autoPrintKot);
  const orderAlertSoundEnabled = usePrinterStore((s) => s.orderAlertSoundEnabled);
  const status = usePrinterStore((s) => s.status);
  const printKOT = usePrinterStore((s) => s.printKOT);
  const connect = usePrinterStore((s) => s.connect);

  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-arm the dismissed banner once QZ Tray reconnects, so a later
  // disconnect shows it again instead of staying hidden forever.
  useEffect(() => {
    if (status === "connected") setBannerDismissed(false);
  }, [status]);

  // Browsers block audio playback until a user gesture has occurred on the
  // page, so the New Order Alert Sound can't just play on mount — it needs
  // one real click/keydown anywhere in the dashboard first. This listens
  // once, dashboard-wide (this provider wraps every dashboard page), and
  // then unlockOrderAlertAudio() keeps the AudioContext usable for the
  // rest of the session.
  useEffect(() => {
    const unlock = () => unlockOrderAlertAudio();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const showToast = (t: { ok: boolean; message: string }) => {
    setToast(t);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    if (t.ok) {
      toastTimeout.current = setTimeout(() => setToast(null), SUCCESS_TOAST_MS);
    }
  };

  // ---- Join the kitchen room and auto-print on every new order --------
  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-kitchen", RESTAURANT_ID);

    const onNewOrder = async (order: Order) => {
      // New Order Alert Sound: fires regardless of the Auto Print KOT
      // toggle below — a staff member who's switched off auto-printing
      // (e.g. printer not set up yet) should still be notified that an
      // order came in. No-ops silently if audio hasn't been unlocked yet
      // (see the gesture-unlock effect above) or if the admin has turned
      // it off in Printer Settings.
      if (orderAlertSoundEnabled) playOrderAlertSound();

      if (!autoPrintKot) return; // toggled off in Printer Settings

      const kot: KOTOrder = {
        orderId: order.orderId,
        tableLabel: order.tableLabel,
        orderType: order.orderType,
        placedAt: order.placedAt,
        specialInstructions: order.specialInstructions,
        tokenNumber: order.tokenNumber,
        items: order.items,
      };

      const result = await printKOT(kot);
      const failures = [
        !result.kitchen.ok ? `Kitchen Printer — ${result.kitchen.error}` : null,
        !result.counter.ok ? `Counter Printer — ${result.counter.error}` : null,
      ].filter((m): m is string => Boolean(m));

      if (failures.length === 0) {
        showToast({ ok: true, message: `KOT auto-printed for order #${order.orderId}.` });
      } else {
        showToast({ ok: false, message: `Order #${order.orderId}: ${failures.join(" · ")}` });
      }
    };

    socket.on("new-order", onNewOrder);
    return () => {
      socket.off("new-order", onNewOrder);
    };
  }, [autoPrintKot, orderAlertSoundEnabled, printKOT]);

  // ---- Keep the QZ Tray connection status fresh while armed -----------
  // PrinterProvider connects once on load; this notices if QZ Tray drops
  // out later (closed, PC slept, etc.) so the banner below stays accurate.
  useEffect(() => {
    if (!autoPrintKot) return;
    const id = setInterval(() => {
      usePrinterStore.getState().refreshPrinters();
    }, CONNECTION_POLL_MS);
    return () => clearInterval(id);
  }, [autoPrintKot]);

  const qzUnavailable = autoPrintKot && status !== "connected" && status !== "connecting";

  return (
    <>
      {qzUnavailable && !bannerDismissed && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            background: "#FCEFE9",
            borderBottom: "1px solid #E9C6B4",
            fontFamily: bodyFont,
          }}
        >
          <AlertTriangle size={16} color="#C24C2E" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#8A3820", flex: 1 }}>
            QZ Tray is not running. Automatic KOT printing is unavailable.
          </span>
          <button
            onClick={() => connect()}
            style={{
              fontFamily: bodyFont,
              fontSize: 12,
              fontWeight: 700,
              color: "#8A3820",
              background: "transparent",
              border: "1px solid #E9C6B4",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8A3820", display: "flex" }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            zIndex: 100,
            maxWidth: 340,
            padding: "10px 14px",
            borderRadius: 10,
            background: toast.ok ? "#EAF5EE" : "#FCEFE9",
            border: `1px solid ${toast.ok ? "#B9DEC5" : "#E9C6B4"}`,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            fontFamily: bodyFont,
            fontSize: 12,
            fontWeight: 600,
            color: toast.ok ? "#2E7D4F" : "#8A3820",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", display: "flex", flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {children}
    </>
  );
}
