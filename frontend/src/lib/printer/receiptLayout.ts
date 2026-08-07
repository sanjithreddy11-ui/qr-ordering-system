// Reusable, printer-agnostic text-layout engine for the session bill.
//
// escpos.ts wraps these plain-text rows with ESC/POS control bytes (bold,
// double-width, cut) for the Rugtek RP-326. ThermalReceipt.tsx renders the
// exact same rows in a monospace <pre> block for the on-screen preview —
// so the printed receipt and the browser preview can never drift apart;
// there is only one place column widths and wrapping rules are decided.

export const COLUMNS_80MM = 48;
export const COLUMNS_58MM = 32;

/** Fixed column widths for the "Qty / Item / Amount" table, shared by both widths. */
const QTY_WIDTH = 4;
const AMOUNT_WIDTH = 10;

export function columnsFor(width: 58 | 80): number {
  return width === 80 ? COLUMNS_80MM : COLUMNS_58MM;
}

export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/** Strips a redundant leading "Table" word so "Table 1" prints as just "1" next to the "Table" label. */
export function tableNumberOnly(label: string): string {
  return label.replace(/^table\s*/i, "").trim() || label;
}

export function money(n: number): string {
  return `Rs.${n.toFixed(2)}`;
}

export function divider(cols: number): string {
  return "-".repeat(cols);
}

export function centerLine(text: string, cols: number): string {
  const pad = Math.max(0, Math.floor((cols - text.length) / 2));
  return " ".repeat(pad) + text;
}

/**
 * Word-wraps `text` into lines no wider than `maxWidth`. Shared by every
 * wrapping helper below (item names, address block, KOT rows) so wrap
 * behaviour — never breaking a word, never truncating — is defined once.
 */
export function wrapWords(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const wrapped: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxWidth && current) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  wrapped.push(current);
  return wrapped;
}

/**
 * Word-wraps `text` to `cols` and centers each resulting line — used as a
 * last-resort fallback when a single address segment is still too long to
 * fit one line. Prefer `wrapCenteredAddress` for restaurant addresses.
 */
export function wrapCentered(text: string, cols: number): string[] {
  return wrapWords(text, cols).map((line) => centerLine(line, cols));
}

/**
 * Breaks a restaurant address into clean, natural lines instead of raw
 * word-wrap:
 *  - If the address already contains explicit line breaks (the owner
 *    formatted it deliberately in Settings), those breaks are respected as-is.
 *  - Otherwise the address is split on commas and greedily grouped so each
 *    line ends at a comma boundary ("...Block No. 8," not "...Block No."
 *    with "8" orphaned onto the next line), which reads far more like a
 *    printed address than mid-word wrapping.
 * Any single segment still wider than `cols` (rare) falls back to word-wrap.
 */
export function wrapAddressLines(address: string, cols: number): string[] {
  if (address.includes("\n")) {
    return address
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => (line.length > cols ? wrapWords(line, cols) : [line]));
  }

  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const lines: string[] = [];
  let current = "";
  for (const seg of segments) {
    const candidate = current ? `${current}, ${seg}` : seg;
    if (candidate.length > cols && current) {
      lines.push(current);
      current = seg;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines.flatMap((line) => (line.length > cols ? wrapWords(line, cols) : [line]));
}

/** Address, broken into natural lines via `wrapAddressLines` and centered. */
export function wrapCenteredAddress(address: string, cols: number): string[] {
  return wrapAddressLines(address, cols).map((line) => centerLine(line, cols));
}

/**
 * Column all contact/header fields ("Ph", "Email", "FSSAI", "GSTIN") on
 * the same label width so their colons line up, then centers the whole
 * "Label : value" row as a single unit — one centering method, matching
 * every other centered line on the receipt (no separate CSS/hardware
 * centering layered on top).
 */
const CONTACT_LABEL_WIDTH = 5;
export function contactLine(label: string, value: string, cols: number): string {
  return centerLine(`${label.padStart(CONTACT_LABEL_WIDTH)} : ${value}`, cols);
}

/** A heading centered on its own line — e.g. "DINE-IN" under the order-details block. */
export function sectionHeading(text: string, cols: number): string {
  return centerLine(text, cols);
}

/** Heavier divider reserved for framing the TOTAL row so it visually stands out. */
export function doubleDivider(cols: number): string {
  return "=".repeat(cols);
}

/** Right-justified label/value row spanning the full printable width — Subtotal/CGST/SGST/Total. */
export function padRow(label: string, value: string, cols: number): string {
  const space = Math.max(1, cols - label.length - value.length);
  return label + " ".repeat(space) + value;
}

/** "Label : value" block row — Bill No / Invoice No / Date / Table / Customer header fields. */
export function fieldRow(label: string, value: string, labelWidth: number): string {
  return `${label.padEnd(labelWidth)}: ${value}`;
}

export function itemTableHeader(cols: number): string {
  const itemWidth = Math.max(8, cols - QTY_WIDTH - AMOUNT_WIDTH);
  return "Qty".padEnd(QTY_WIDTH) + "Item".padEnd(itemWidth) + "Amount".padStart(AMOUNT_WIDTH);
}

/**
 * Column header for the KOT item table ("Qty   Item") — no Amount column,
 * same reasoning as kotItemRows below (the kitchen doesn't need to see
 * money). Shares the same Qty column width as kotItemRows so the header
 * and every item row line up under it.
 */
export function kotItemTableHeader(cols: number): string {
  return "Qty".padEnd(QTY_WIDTH) + "Item";
}

/**
 * Formats a Daily Token Number for display — zero-padded to 3 digits
 * (e.g. "001", "042", "137") regardless of how large the underlying
 * number is stored as. Shared by the KOT header and the bill/receipt so a
 * session's token always reads identically everywhere it's printed.
 */
export function formatTokenNumber(tokenNumber: number | string): string {
  const n = Number(tokenNumber);
  if (!Number.isFinite(n)) return String(tokenNumber);
  return String(n).padStart(3, "0");
}

/**
 * One item's row(s) in the item table. Long names wrap onto extra lines
 * (indented under the Item column) instead of being silently truncated,
 * so nothing important is ever lost off the edge of the paper.
 */
export function itemRows(qty: number, name: string, amount: string, cols: number): string[] {
  const itemWidth = Math.max(8, cols - QTY_WIDTH - AMOUNT_WIDTH);

  return wrapWords(name, itemWidth).map((line, i) => {
    const left = (i === 0 ? String(qty).padEnd(QTY_WIDTH) : " ".repeat(QTY_WIDTH)) + line.padEnd(itemWidth);
    const right = (i === 0 ? amount : "").padStart(AMOUNT_WIDTH);
    return (left + right).trimEnd();
  });
}

/**
 * One item's row(s) for the Kitchen Order Ticket — qty + name only, no
 * price/amount column (the kitchen doesn't need to see money). Reuses the
 * same word-wrap behaviour as itemRows so long dish names still wrap
 * instead of truncating.
 */
export function kotItemRows(qty: number, name: string, cols: number): string[] {
  const itemWidth = Math.max(8, cols - QTY_WIDTH);

  return wrapWords(name, itemWidth).map((line, i) =>
    ((i === 0 ? String(qty).padEnd(QTY_WIDTH) : " ".repeat(QTY_WIDTH)) + line).trimEnd()
  );
}

/**
 * Menu Item Customization (Modifiers): one indented bullet line per
 * selected modifier under a KOT item, e.g. "  • Sauce: Red Sauce" — so the
 * kitchen always knows exactly which sauce (or any future modifier) this
 * exact line needs, never just the item name. Indented under the Qty
 * column (same width) so it visually nests under the item it belongs to.
 * Long "Group: Option" text wraps like any other KOT text rather than
 * truncating.
 */
export function modifierRows(modifiers: { groupName: string; optionName: string }[], cols: number): string[] {
  const BULLET = "\u2022 "; // "• "
  const indent = " ".repeat(QTY_WIDTH + 1);
  const bulletWidth = Math.max(8, cols - indent.length - BULLET.length);

  return modifiers.flatMap(({ groupName, optionName }) => {
    const text = `${groupName}: ${optionName}`;
    return wrapWords(text, bulletWidth).map((seg, i) =>
      i === 0 ? `${indent}${BULLET}${seg}` : `${indent}${" ".repeat(BULLET.length)}${seg}`
    );
  });
}

/**
 * Formats the customer's checkout "Special Instructions" free text as a
 * bulleted list for the KOT. Each line the customer actually typed (their
 * own line breaks in the textarea) becomes its own bullet, so their
 * formatting is preserved rather than being reflowed into one paragraph.
 * A single line still too wide for the paper wraps like any other KOT
 * text, with continuation lines indented under the bullet instead of the
 * bullet glyph.
 */
export function specialInstructionRows(text: string, cols: number): string[] {
  const BULLET = "\u2022 "; // "• "
  const bulletWidth = Math.max(8, cols - BULLET.length);

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) =>
      wrapWords(line, bulletWidth).map((seg, i) => (i === 0 ? `${BULLET}${seg}` : `${" ".repeat(BULLET.length)}${seg}`))
    );
}