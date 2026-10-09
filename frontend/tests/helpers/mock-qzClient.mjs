// In-memory stand-in for src/lib/printer/qzClient.ts. Records every payload
// that would have been sent to a physical printer so tests can assert on the
// exact ticket data. NOT a test of real printer hardware.
export class PrinterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PrinterError";
    this.code = code;
  }
}

export const printed = []; // [{ printerName, payload }]
const state = { failFor: new Set() };

export function resetPrinterMock() {
  printed.length = 0;
  state.failFor.clear();
}
/** Make printRaw throw for this printer name until clearPrinterFailure(). */
export function failPrinter(name) {
  state.failFor.add(name);
}
export function clearPrinterFailure(name) {
  state.failFor.delete(name);
}

export async function isConnected() { return true; }
export async function connect() {}
export async function disconnect() {}
export async function listPrinters() { return ["KITCHEN-PRN", "COUNTER-PRN"]; }
export async function getDefaultPrinter() { return null; }
export async function printRaw(printerName, payload) {
  if (state.failFor.has(printerName)) {
    throw new PrinterError("PRINT_FAILED", `${printerName} is offline`);
  }
  printed.push({ printerName, payload });
}
