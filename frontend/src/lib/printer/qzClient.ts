// Thin wrapper around the `qz-tray` browser SDK.
//
// Everything QZ-specific (websocket lifecycle, security promises, printer
// discovery, raw printing) is isolated here so the rest of the app only
// talks to the small API exported below. This keeps the integration
// swappable (e.g. adding a second print agent later) without touching
// components.
//
// QZ Tray must be running locally (https://qz.io) — this only talks to the
// already-installed desktop app over a local websocket, it never reaches
// out to the Denova backend on Render for printing.
//
// The one thing that DOES hit the backend is signing: QZ Tray identifies
// this app by a certificate and expects every connection/print request to
// be signed with the matching private key (see backend/src/config/qzCert.js
// and backend/src/controllers/qzController.js). That's what lets staff
// approve QZ Tray once — not on every single print job.

import { API_BASE_URL } from "@/lib/config";

export class PrinterError extends Error {
  code: "QZ_NOT_RUNNING" | "PRINTER_NOT_FOUND" | "PRINT_FAILED" | "CONNECTION_FAILED";
  constructor(code: PrinterError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "PrinterError";
  }
}

// qz-tray ships as a UMD bundle with community types (@types/qz-tray).
// Loaded lazily (never at module-eval time) because it touches `window`
// and isn't meaningful during SSR/build.
type QzTray = typeof import("qz-tray");
let qzPromise: Promise<QzTray> | null = null;

async function loadQz(): Promise<QzTray> {
  if (!qzPromise) {
    qzPromise = import("qz-tray").then((mod) => {
      const qz = (mod.default ?? mod) as QzTray;

      // Certificate: fetched once from the backend (which holds the
      // matching private key) so QZ Tray can identify this app by a
      // stable identity instead of an anonymous/blank one. A stable
      // identity is what lets the printer PC's "Remember this decision"
      // checkbox actually stick across restarts.
      qz.security.setCertificatePromise((resolve, reject) => {
        fetch(`${API_BASE_URL}/api/qz/cert`)
          .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`cert fetch failed: ${res.status}`))))
          .then(resolve)
          .catch((err) => reject(err instanceof Error ? err.message : String(err)));
      });

      // Signature: for every websocket/print request, QZ Tray generates a
      // nonce ("toSign") and asks us to prove we hold the private key for
      // the certificate above. The private key itself never touches the
      // browser — the backend signs it and returns just the signature.
      qz.security.setSignatureAlgorithm("SHA512");
      qz.security.setSignaturePromise((toSign: string) => (resolve: (v: string) => void, reject: (err?: string) => void) => {
        fetch(`${API_BASE_URL}/api/qz/sign?request=${encodeURIComponent(toSign)}`)
          .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`sign fetch failed: ${res.status}`))))
          .then(resolve)
          .catch((err) => reject(err instanceof Error ? err.message : String(err)));
      });

      return qz;
    });
  }
  return qzPromise;
}

function isConnectionRefused(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /unable to establish|connect|websocket|refused/i.test(msg);
}

/** True once we have a live websocket session with the QZ Tray desktop app. */
export async function isConnected(): Promise<boolean> {
  try {
    const qz = await loadQz();
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

/** Opens the websocket to QZ Tray (a no-op if already connected). */
export async function connect(): Promise<void> {
  const qz = await loadQz();
  if (qz.websocket.isActive()) return;

  try {
    await qz.websocket.connect({ retries: 2, delay: 1 });
  } catch (err) {
    if (isConnectionRefused(err)) {
      throw new PrinterError(
        "QZ_NOT_RUNNING",
        "Can't reach QZ Tray. Make sure the QZ Tray app is running on this PC (check the system tray icon)."
      );
    }
    throw new PrinterError("CONNECTION_FAILED", err instanceof Error ? err.message : "Could not connect to QZ Tray.");
  }
}

export async function disconnect(): Promise<void> {
  const qz = await loadQz();
  if (qz.websocket.isActive()) {
    await qz.websocket.disconnect();
  }
}

/** All printers currently registered with Windows (same list as Printers & Scanners). */
export async function listPrinters(): Promise<string[]> {
  const qz = await loadQz();
  try {
    const printers = await qz.printers.find();
    return Array.isArray(printers) ? printers : [printers];
  } catch (err) {
    throw new PrinterError("PRINT_FAILED", err instanceof Error ? err.message : "Could not list printers.");
  }
}

export async function getDefaultPrinter(): Promise<string | null> {
  const qz = await loadQz();
  try {
    const name = await qz.printers.getDefault();
    return name || null;
  } catch {
    return null;
  }
}

/** Sends raw ESC/POS bytes (as a string) straight to the printer's spooler queue. */
export async function printRaw(printerName: string, escposPayload: string): Promise<void> {
  const qz = await loadQz();

  if (!qz.websocket.isActive()) {
    throw new PrinterError("QZ_NOT_RUNNING", "QZ Tray is not connected. Reconnect from Printer Settings and try again.");
  }

  const config = qz.configs.create(printerName, {
    encoding: "UTF-8",
    rasterize: false,
  });

  try {
    await qz.print(config, [
      {
        type: "raw",
        format: "command",
        flavor: "plain",
        data: escposPayload,
      },
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/printer.*not found|no such printer|invalid printer/i.test(msg)) {
      throw new PrinterError("PRINTER_NOT_FOUND", `Printer "${printerName}" is no longer available. Re-check Printer Settings.`);
    }
    throw new PrinterError("PRINT_FAILED", `Print job failed: ${msg}`);
  }
}
