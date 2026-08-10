// ESC/POS formatting for the Kitchen Order Ticket (KOT).
//
// A KOT is intentionally NOT a bill: no prices, no GST, no totals, no
// payment info — just what the kitchen/counter needs to prepare the order.
// Column layout is shared with escpos.ts via receiptLayout.ts so the KOT
// and the bill can never visually disagree on paper width/margins, but the
// two documents are built by two separate functions on purpose (KOTFormatter
// vs BillFormatter) so a change to one can never accidentally change the
// other.
//
// An order can contain both food and beverage items. Rather than printing
// one identical KOT to both printers, each line item is routed to exactly
// one printer based on its menu category (see CATEGORY_PRINTER_ROLE below),
// and a separate ticket — with its own heading — is built per printer from
// only the items routed to it.

import {
  columnsFor,
  divider,
  doubleDivider,
  centerLine,
  sectionHeading,
  fieldRow,
  kotItemRows,
  kotItemTableHeader,
  modifierRows,
  specialInstructionRows,
  tableNumberOnly,
  formatTokenNumber,
} from "./receiptLayout";

const ESC = "\x1B";
const GS = "\x1D";

const CMD = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a0`,
  ALIGN_CENTER: `${ESC}a1`,
  BOLD_ON: `${ESC}E1`,
  BOLD_OFF: `${ESC}E0`,
  DOUBLE_ON: `${GS}!\x11`, // double width + double height — the ticket title (largest)
  // Medium size for the Table No. line: double HEIGHT only, normal width —
  // deliberately between the title (double width+height) and the plain
  // body text below (normal 1x1), per the "larger than the rest of the
  // ticket but smaller than the title" header requirement.
  MEDIUM_ON: `${GS}!\x01`,
  DOUBLE_OFF: `${GS}!\x00`,
  FEED: (lines: number) => `${ESC}d${String.fromCharCode(lines)}`,
  CUT: `${GS}V\x42\x00`, // partial cut, no extra feed
};

const HEADER_LABEL_WIDTH = 10;

export type KOTPrinterRole = "kitchen" | "counter";

/** Ticket heading, per printer — see requirements: Kitchen Printer prints
 *  "KITCHEN ORDER TICKET", Counter Printer prints "BEVERAGE ORDER TICKET". */
const KOT_HEADING: Record<KOTPrinterRole, string> = {
  kitchen: "KITCHEN ORDER TICKET",
  counter: "BEVERAGE ORDER TICKET",
};

// Category → printer routing. Beverage categories print on the Counter
// Printer only; food categories print on the Kitchen Printer only. This is
// deliberately keyed by *category*, never by individual item name/id, so
// any new menu item automatically routes correctly as long as it's filed
// under one of these categories — no code change needed per item.
const COUNTER_CATEGORIES = [
  "Iced Coffee",
  "Dirty Coffee",
  "Iced Tea",
  "Cold Coffee",
  "Hot Coffee",
  "Hot Tea",
  "Mojitos",
  "Shakes",
  "Water Bottle",
  "Desserts",
];

const KITCHEN_CATEGORIES = [
  "All Day Breakfast",
  "Pizzas (9 Inch)",
  "Sandwiches",
  "Appetizers",
  "Bread",
  "Burgers",
  "Large Plate",
  "Pasta",
  "Salads",
  "Small Bites",
  "Add Ons",
];

/** Normalized (trimmed, lowercased) lookup so routing isn't sensitive to
 *  incidental whitespace/casing differences in how a category was typed. */
function normalizeCategory(categoryTitle: string): string {
  return categoryTitle.trim().toLowerCase();
}

const COUNTER_CATEGORY_SET = new Set(COUNTER_CATEGORIES.map(normalizeCategory));
const KITCHEN_CATEGORY_SET = new Set(KITCHEN_CATEGORIES.map(normalizeCategory));

// Item-level override: Chocolate Waffle and Nutella Waffle live in the
// Desserts category (which otherwise routes to the Counter Printer), but
// both need to be cooked on the waffle iron, so they must still print on
// the Kitchen Printer. Every other Desserts item continues to print on the
// Counter Printer as normal — this is a narrow, explicit two-item
// exception, not a change to Desserts' category routing.
//
// Keyed primarily by the menu item's stable `id` (survives renames/re-seeds
// as long as the id itself is unchanged), with a normalized-name fallback
// for the rare case a KOT line is missing its id (e.g. an older order
// snapshot predating the `id` field on order lines).
const KITCHEN_OVERRIDE_ITEM_IDS = new Set(["chocolate-waffle", "nutella-waffle"]);
const KITCHEN_OVERRIDE_ITEM_NAMES = new Set(["Chocolate Waffle", "Nutella Waffle"].map(normalizeCategory));

function isKitchenOverrideItem(item: { id?: string; name?: string } | undefined): boolean {
  const id = item?.id?.trim().toLowerCase();
  if (id) return KITCHEN_OVERRIDE_ITEM_IDS.has(id);
  return KITCHEN_OVERRIDE_ITEM_NAMES.has(normalizeCategory(item?.name ?? ""));
}

/**
 * Resolves which printer a single order line belongs on — primarily by
 * category, with a narrow item-level override (see
 * KITCHEN_OVERRIDE_ITEM_IDS above) for the handful of items that need to
 * print on a different printer than the rest of their category.
 *
 * A category that matches neither list (e.g. a brand-new menu category
 * created before this routing table is updated) falls back to the Kitchen
 * Printer, so an unrecognized item is never silently dropped from every
 * KOT — it still reaches a printer, just not necessarily the ideal one.
 *
 * Exported (previously module-private) so UI that needs to *display* an
 * item's destination printer ahead of printing — e.g. the Print KOT
 * selection modal's per-item badge — can call the exact same routing
 * decision `splitKOTItemsByPrinter`/`buildEscPosKOT` will use, instead of
 * re-deriving it. Never call this to change routing; it's read-only.
 */
export function resolvePrinterRole(item: { id?: string; name?: string; categoryTitle?: string } | undefined): KOTPrinterRole {
  if (isKitchenOverrideItem(item)) return "kitchen";

  const key = normalizeCategory(item?.categoryTitle ?? "");
  if (COUNTER_CATEGORY_SET.has(key)) return "counter";
  if (KITCHEN_CATEGORY_SET.has(key)) return "kitchen";
  return "kitchen";
}

/** The minimal order shape a KOT needs — a subset shared by both the live
 *  Socket.IO `Order` payload and the `RecentOrder` admin-api type, so this
 *  formatter works with either without extra mapping. */
export interface KOTOrder {
  orderId: string;
  tableLabel?: string | null;
  orderType: "dine-in" | "takeaway";
  placedAt: string;
  specialInstructions?: string;
  // Daily Token Number System: the dining session's token number (see
  // backend models/TableSession.js), assigned once when the session was
  // created and identical for every order/KOT/reprint that session ever
  // produces. Optional/absent for orders that predate this feature or have
  // no table session (e.g. takeaway) — the header simply omits the Token
  // No. row in that case, same pattern as the old tableLabel fallback.
  tokenNumber?: number | string | null;
  items: {
    item: { id?: string; name: string; categoryTitle?: string };
    quantity: number;
    // Menu Item Customization (Modifiers): the selected sauce (or any
    // future modifier) for this exact line, printed as indented bullets
    // right under the item — see modifierRows in receiptLayout.ts. Two
    // lines for the same item with different modifiers are never merged;
    // each stays its own row in this array with its own quantity (see
    // backend services/orderService.js validateAndBuildOrder).
    modifiers?: { groupName: string; optionName: string }[];
  }[];
}

export type KOTOrderItem = KOTOrder["items"][number];

/**
 * Splits an order's line items into the subset that belongs on the Kitchen
 * Printer and the subset that belongs on the Counter Printer, by category.
 * Every item ends up in exactly one bucket — never both, never neither.
 */
export function splitKOTItemsByPrinter(items: KOTOrderItem[]): Record<KOTPrinterRole, KOTOrderItem[]> {
  const split: Record<KOTPrinterRole, KOTOrderItem[]> = { kitchen: [], counter: [] };
  for (const line of items ?? []) {
    split[resolvePrinterRole(line.item)].push(line);
  }
  return split;
}

/**
 * Builds the full ESC/POS payload for one printer's Kitchen/Beverage Order
 * Ticket, ready for qzClient.printRaw(). `items` should already be the
 * subset routed to `role` (via splitKOTItemsByPrinter) — this function
 * doesn't filter by category itself, so the same order/header fields can
 * be reused for both tickets while each only lists its own items.
 */
export function buildEscPosKOT(order: KOTOrder, role: KOTPrinterRole, items: KOTOrderItem[], width: 58 | 80 = 80): string {
  const cols = columnsFor(width);

  let out = CMD.INIT + CMD.ALIGN_CENTER;

  // ---- Ticket title — centered, bold, largest text on the ticket --------
  out += CMD.BOLD_ON;
  out += doubleDivider(cols) + "\n";
  out += CMD.DOUBLE_ON;
  out += centerLine(KOT_HEADING[role], Math.floor(cols / 2)) + "\n";
  out += CMD.DOUBLE_OFF;
  out += doubleDivider(cols) + "\n";
  out += CMD.BOLD_OFF;

  // ---- Table No. — the primary identifier, centered directly below the
  // title in a medium bold font (bigger than the body text below, smaller
  // than the title above). Takeaway orders have no table to show, so this
  // falls back to the order type instead — same "no table" case the old
  // "Table :" row used to handle, just promoted into this same slot rather
  // than dropped. ---------------------------------------------------------
  out += CMD.BOLD_ON + CMD.MEDIUM_ON;
  out += order.tableLabel
    ? centerLine(`TABLE NO. ${tableNumberOnly(order.tableLabel)}`, cols) + "\n"
    : centerLine(order.orderType === "dine-in" ? "DINE-IN" : "TAKEAWAY", cols) + "\n";
  out += CMD.DOUBLE_OFF + CMD.BOLD_OFF;

  // ---- Token No. / Date / Time — normal font size, left-aligned fields --
  out += CMD.ALIGN_LEFT;
  if (order.tokenNumber != null && order.tokenNumber !== "") {
    out += fieldRow("Token No", formatTokenNumber(order.tokenNumber), HEADER_LABEL_WIDTH) + "\n";
  }
  out += fieldRow("Date", new Date(order.placedAt).toLocaleDateString("en-IN"), HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Time", new Date(order.placedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), HEADER_LABEL_WIDTH) + "\n";
  out += divider(cols) + "\n";

  // ---- Items table ---------------------------------------------------------
  out += CMD.BOLD_ON + kotItemTableHeader(cols) + "\n" + CMD.BOLD_OFF;
  out += divider(cols) + "\n";
  (items ?? []).forEach((line) => {
    out += CMD.BOLD_ON;
    kotItemRows(line.quantity, line.item.name, cols).forEach((row) => {
      out += row + "\n";
    });
    out += CMD.BOLD_OFF;
    // Menu Item Customization (Modifiers): printed directly under the item
    // they belong to, not bold — visually distinct from the dish name but
    // still impossible for the kitchen to miss.
    if (line.modifiers && line.modifiers.length > 0) {
      modifierRows(line.modifiers, cols).forEach((row) => {
        out += row + "\n";
      });
    }
  });
  out += divider(cols) + "\n";

  const instructionRows = order.specialInstructions?.trim() ? specialInstructionRows(order.specialInstructions, cols) : [];
  if (instructionRows.length > 0) {
    out += CMD.BOLD_ON + sectionHeading("SPECIAL INSTRUCTIONS", cols) + "\n" + CMD.BOLD_OFF;
    out += divider(cols) + "\n";
    instructionRows.forEach((row) => {
      out += row + "\n";
    });
    out += divider(cols) + "\n";
  }

  out += CMD.FEED(3) + CMD.CUT;
  return out;
}