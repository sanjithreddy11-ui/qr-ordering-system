# CHANGELOG — Investment & Expenses Module

This changelog documents every file touched to add the **Investment & Expenses**
module to the existing QR Ordering System admin panel.

## New files — Backend

| File | Purpose |
|---|---|
| `backend/src/models/Vendor.js` | Vendor/supplier records for the module (name, GSTIN, contact, categories, notes). |
| `backend/src/models/ExpenseCategory.js` | Custom expense categories a restaurant adds on top of the built-in default list. |
| `backend/src/models/Purchase.js` | Purchase invoice line items with full GST breakdown (CGST/SGST/IGST), payment tracking, and optional Stock Management link. |
| `backend/src/models/Expense.js` | General business expenses (rent, utilities, salaries, etc.), optionally linked to a vendor or a recurring expense. |
| `backend/src/models/Asset.js` | Long-term business assets (equipment, furniture, POS devices, etc.). |
| `backend/src/models/RecurringExpense.js` | Templates for repeating bills (Rent, Electricity, Internet, …) with a rolling `nextDueDate`. |
| `backend/src/services/investmentService.js` | Shared logic: GST calculation, default expense categories, Stock Management auto-sync, revenue helper (reused by Profit Analysis), serializers. |
| `backend/src/controllers/vendorController.js` | Vendor CRUD + purchase/expense history + computed outstanding balance. |
| `backend/src/controllers/investmentPurchaseController.js` | Purchase CRUD with server-side GST/total calculation and Stock Management sync. |
| `backend/src/controllers/expenseController.js` | Expense CRUD, expense category CRUD, and recurring expense CRUD + "record payment" action. |
| `backend/src/controllers/assetController.js` | Asset CRUD. |
| `backend/src/controllers/investmentReportController.js` | Overview dashboard (cards + 5 charts), Input GST report, Profit Analysis (vs. Order revenue), and exportable Daily/Weekly/Monthly/GST/Vendor/Purchase/Investment/P&L reports (JSON + CSV). |
| `backend/src/routes/adminInvestmentRoutes.js` | Mounts all of the above under `/api/admin/investment`, gated by `requireAdminRole`. |

## Modified files — Backend

| File | Change |
|---|---|
| `backend/src/app.js` | Mounted `adminInvestmentRoutes` at `/api/admin/investment`. **Also mounted `adminInventoryRoutes` and `adminSupplierRoutes`**, which existed in the codebase already (with a working frontend caller in `lib/admin-api.ts`) but were never wired into `app.js` — so Stock Management's ingredient/purchase/supplier calls were 404ing before this change. This was necessary groundwork: the spec's "automatically increase stock quantity" requirement needs a working inventory API to call. |
| `backend/src/middleware/auth.js` | Added `requireAdminRole` — gates the whole Investment & Expenses router to `staff.role === "admin"` (this codebase has no separate "owner" role; `admin` is treated as the owner/admin tier). |
| `backend/src/middleware/upload.js` | Added a second multer instance, `invoiceUpload`, accepting PDF/PNG/JPEG (10MB limit) for invoice uploads. The original `upload` (images only, used by Menu etc.) is untouched. |
| `backend/src/controllers/uploadController.js` | Added `uploadInvoice` handler, used by the new `/api/admin/investment/upload` route. |

## New files — Frontend

| File | Purpose |
|---|---|
| `frontend/src/app/(admin)/dashboard/investment/page.tsx` | Page shell with the 9-tab navigation (Overview, Purchases, Expenses, Assets, Vendors, GST Reports, Profit Analysis, Reports, Settings), following the exact pattern of the existing GST Management page. |
| `frontend/src/components/admin/investment/OverviewTab.tsx` | 8 summary cards + 5 charts (Monthly Expense Trend, Category Breakdown, Vendor Spending, Monthly Profit, GST Paid) using Recharts, matching the existing dashboard's chart styling. |
| `frontend/src/components/admin/investment/PurchasesTab.tsx` | Searchable/filterable purchase table + Add/Edit Purchase modal with live subtotal/GST/grand-total calculation and invoice upload. |
| `frontend/src/components/admin/investment/ExpensesTab.tsx` | Expense table + Add/Edit modal with invoice upload. |
| `frontend/src/components/admin/investment/AssetsTab.tsx` | Asset cards + Add/Edit modal. |
| `frontend/src/components/admin/investment/VendorsTab.tsx` | Vendor cards (with computed outstanding balance) + Add/Edit modal + a detail view showing purchase/expense history per vendor. |
| `frontend/src/components/admin/investment/InvestmentGstReportsTab.tsx` | Input GST report (the purchases-side counterpart to the existing sales-side GST Reports tab), with the same Print / Excel / PDF export pattern (`xlsx`, `jspdf` + `jspdf-autotable`, already dependencies of this project). |
| `frontend/src/components/admin/investment/ProfitAnalysisTab.tsx` | Revenue vs. expenses vs. net profit / profit margin / expense ratio for a date range, pulling revenue from the existing Order data. |
| `frontend/src/components/admin/investment/ReportsTab.tsx` | Daily / Weekly / Monthly / GST / Vendor / Purchase / Investment / P&L report generator with Print / Excel / PDF export. |
| `frontend/src/components/admin/investment/SettingsTab.tsx` | Custom expense category management + recurring expense management (add / record payment / stop), with an "Owner/Admin only" notice. |

## Modified files — Frontend

| File | Change |
|---|---|
| `frontend/src/components/admin/AdminSidebar.tsx` | Added an "Investment & Expenses" nav item directly below "Stock Management", using the same `lucide-react` icon convention as the rest of the sidebar (`PiggyBank`). |
| `frontend/src/lib/admin-api.ts` | Appended a full "Investment & Expenses" API client section (types + fetch functions for vendors, purchases, expenses, categories, recurring expenses, assets, invoice upload, overview, GST report, profit analysis, and generic reports) — additive only, nothing existing was changed. |

## Design decisions worth knowing about

- **GST Entries are derived, not duplicated.** Rather than a separate "GST Entries" collection that could drift out of sync with Purchases, Input GST reporting is computed directly from `Purchase.gstAmount/cgst/sgst/igst` via aggregation — the same pattern this codebase already uses for other derived values (e.g. `Ingredient` status).
- **Stock Management integration is best-effort and non-blocking.** A purchase whose category/product name matches an existing `Ingredient` (case-insensitive) automatically increases that ingredient's stock and logs a `StockMovement`, reusing `stockService` so it behaves identically to a manual restock. If the stock sync fails for any reason, the purchase itself is still saved — it never gets lost behind an inventory-matching error.
- **PDF/Excel export uses the libraries already in `package.json`** (`xlsx`, `jspdf`, `jspdf-autotable`) rather than adding new dependencies, mirroring the existing GST Reports tab's export implementation exactly.
- **Vendor is a new, separate collection from the existing `Supplier` model.** `Supplier` backs Stock Management's ingredient restocking; `Vendor` here carries the GSTIN/statutory fields and outstanding-balance ledger the spec asks for. Purchases/Expenses/Assets can optionally reference a `Vendor`.
- **Permissions** are enforced server-side (`requireAdminRole` on the whole `/api/admin/investment` router) and mirrored client-side (the page shows a "restricted" message for non-admin staff) rather than just hidden in the UI.

## Known trade-offs / follow-ups

- The pre-existing `Stock Management` 404 bug (see `app.js` above) was fixed as required groundwork for this module's stock-sync feature. It was **not** otherwise part of the Investment & Expenses spec, so please sanity-check Stock Management's own behavior after upgrading, since it was previously untested in production (its API calls were failing silently).
- Expense category deletion exists as a backend endpoint (`DELETE /api/admin/investment/categories/:restaurantId/:categoryId`) but isn't wired into the Settings UI, since the category list endpoint intentionally returns plain names (merging built-in + custom) rather than IDs — this keeps the "add category" flow trivial anywhere a category dropdown is used. Deleting a custom category is possible via a direct API call today; a small follow-up (returning `{id, name}` pairs to the UI, or resolving the id from a name lookup) would surface a delete button.
- Recurring expenses are surfaced in the **Settings** tab (their natural home, since that's where they're created/managed) rather than as a separate top-level tab — the "Upcoming Recurring Payments" list requested by the spec is at the bottom of that tab.
- No background scheduler exists in this codebase, so recurring expenses don't auto-post on their due date; a staff member clicks the checkmark to record that cycle's payment, which creates the `Expense` row and advances `nextDueDate`.
