// Daily Token Number System: the "business date" a dining session's token
// number belongs to — used both to partition the daily counter (see
// createTableSessionWithToken.js) and to decide when it resets.
//
// This app has no per-restaurant timezone setting yet (every date/time
// shown on receipts and KOTs elsewhere already assumes en-IN/Asia/Kolkata —
// see e.g. receiptLayout.ts callers using toLocaleDateString("en-IN")), so
// "today" here is deliberately computed in Asia/Kolkata rather than the
// server's own timezone (which may be UTC in production). Without this, a
// restaurant open past ~5:30am UTC would see tokens silently reset mid
// service, or a late-night order would already be numbered for "tomorrow".
//
// Returns e.g. "2026-08-07" (YYYY-MM-DD) — sortable/comparable as a plain
// string, and stable regardless of what time zone the value is later read
// back in.
function getBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

module.exports = getBusinessDate;
