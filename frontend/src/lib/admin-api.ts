import { API_BASE_URL } from "@/lib/config";
import { useAuthStore } from "@/store/auth-store";

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body as T;
}

// Attaches the admin JWT (see store/auth-store.ts) to every /api/admin/*
// and /api/orders/analytics request. Falls back to a plain fetch if no
// token is set, so callers get a clean 401 from the backend rather than
// a confusing client-side error.
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: authHeaders(init.headers as Record<string, string>),
    cache: init.cache ?? "no-store",
  });
  if (res.status === 401) {
    // Token missing/expired/invalid — clear the stale session so the
    // dashboard's auth guard redirects to /login on the next render.
    useAuthStore.getState().logout();
  }
  return res;
}

// ---------- Auth ----------

export interface LoginResponse {
  token: string;
  staff: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "kitchen" | "waiter";
    restaurantId: string;
  };
}

export async function adminLogin(
  restaurantId: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, email, password }),
  });
  return handle<LoginResponse>(res);
}

// ---------- Menu ----------

// Menu Item Customization (Modifiers): mirrors backend models/MenuItem.js
// modifierGroupSchema/modifierOptionSchema. Generic — nothing here is
// specific to sauces — so any future modifier group (spice level, size,
// add-ons) uses the exact same shape.
export interface AdminModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface AdminModifierGroup {
  id: string;
  name: string;
  required: boolean;
  selectionType: "single" | "multiple";
  options: AdminModifierOption[];
}

// Menu Item Customization (Modifiers): the selected option(s) snapshotted
// onto an order line — mirrors backend models/Order.js
// orderItemModifierSchema.
export interface SelectedOrderModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface AdminMenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  categoryTitle: string;
  categorySortOrder: number;
  name: string;
  description: string;
  price: number;
  diet: "veg" | "non-veg";
  image: string;
  sortOrder: number;
  prepTimeMinutes: number;
  isAvailable: boolean;
  // GST Management Module: percentage this item is billed at, or null to
  // use the restaurant's default GST % (see GstSettings). Assigned from
  // the Menu Management item form.
  gstSlab: number | null;
  hsnCode: string;
  // Menu Item Customization (Modifiers): absent/[] for a plain item.
  modifierGroups?: AdminModifierGroup[];
}

export interface MenuItemsPage {
  items: AdminMenuItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface MenuItemFilters {
  search?: string;
  categoryId?: string;
  diet?: "veg" | "non-veg";
  availability?: "available" | "out-of-stock";
  page?: number;
  limit?: number;
}

export async function fetchAdminMenuItems(
  restaurantId: string,
  filters: MenuItemFilters = {}
): Promise<MenuItemsPage> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.diet) params.set("diet", filters.diet);
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const qs = params.toString();
  const res = await authFetch(`/api/admin/menu/${restaurantId}${qs ? `?${qs}` : ""}`);
  return handle<MenuItemsPage>(res);
}

export async function createAdminMenuItem(payload: Partial<AdminMenuItem>): Promise<AdminMenuItem> {
  const res = await authFetch(`/api/admin/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ item: AdminMenuItem }>(res);
  return data.item;
}

export async function updateAdminMenuItem(
  restaurantId: string,
  itemId: string,
  updates: Partial<AdminMenuItem>
): Promise<AdminMenuItem> {
  const res = await authFetch(`/api/admin/menu/${restaurantId}/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ item: AdminMenuItem }>(res);
  return data.item;
}

export async function deleteAdminMenuItem(restaurantId: string, itemId: string): Promise<void> {
  const res = await authFetch(`/api/admin/menu/${restaurantId}/${itemId}`, { method: "DELETE" });
  await handle(res);
}

export async function uploadAdminImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await authFetch(`/api/admin/upload`, { method: "POST", body: formData });
  const data = await handle<{ url: string }>(res);
  return data.url;
}

// ---------- Categories ----------

export interface AdminCategory {
  id: string;
  restaurantId: string;
  categoryId: string;
  title: string;
  sortOrder: number;
  itemCount: number;
}

export async function fetchAdminCategories(restaurantId: string): Promise<AdminCategory[]> {
  const res = await authFetch(`/api/admin/categories/${restaurantId}`);
  const data = await handle<{ categories: AdminCategory[] }>(res);
  return data.categories;
}

export async function createAdminCategory(payload: {
  restaurantId: string;
  categoryId: string;
  title: string;
  sortOrder?: number;
}): Promise<AdminCategory> {
  const res = await authFetch(`/api/admin/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ category: AdminCategory }>(res);
  return data.category;
}

export async function updateAdminCategory(
  restaurantId: string,
  categoryId: string,
  updates: { title?: string; sortOrder?: number }
): Promise<AdminCategory> {
  const res = await authFetch(`/api/admin/categories/${restaurantId}/${categoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ category: AdminCategory }>(res);
  return data.category;
}

export async function deleteAdminCategory(restaurantId: string, categoryId: string): Promise<void> {
  const res = await authFetch(`/api/admin/categories/${restaurantId}/${categoryId}`, {
    method: "DELETE",
  });
  await handle(res);
}

// ---------- Tables ----------

export interface AdminTable {
  _id: string;
  restaurantId: string;
  token: string;
  label: string;
  isActive: boolean;
}

export async function fetchAdminTables(restaurantId: string): Promise<AdminTable[]> {
  const res = await authFetch(`/api/admin/tables/${restaurantId}`);
  const data = await handle<{ tables: AdminTable[] }>(res);
  return data.tables;
}

export async function createAdminTable(restaurantId: string, label: string): Promise<AdminTable> {
  const res = await authFetch(`/api/admin/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, label }),
  });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

export async function updateAdminTable(
  tableId: string,
  updates: { label?: string; isActive?: boolean }
): Promise<AdminTable> {
  const res = await authFetch(`/api/admin/tables/${tableId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

export async function deleteAdminTable(tableId: string): Promise<void> {
  const res = await authFetch(`/api/admin/tables/${tableId}`, { method: "DELETE" });
  await handle(res);
}

// ---------- Table Management ----------

export type TableStatus =
  | "available"
  | "reserved"
  | "occupied"
  | "billing"
  | "awaiting_payment"
  | "cleaning"
  | "out_of_service";

export type PaymentMethod = "upi" | "cash" | "card";
export type PaymentStatus = "pending" | "paid";

export interface TableSessionData {
  sessionId: string;
  restaurantId: string;
  tableId: string;
  tableToken: string;
  customerName: string;
  phoneNumber: string;
  reservationId: string | null;
  orderIds: string[];
  sessionStart: string;
  sessionEnd: string | null;
  currentBill: number;
  status: "active" | "closed";
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  transactionId: string | null;
  paidAt: string | null;
  billPrinted: boolean;
  invoiceNumber: string | null;
  printedAt: string | null;
  printedBy: string | null;
  printCount: number;
  // Daily Token Number System: assigned once, at session creation, and
  // unchanged for the life of the session — see backend models/TableSession.js.
  tokenNumber?: number | null;
  businessDate?: string | null;
  // Settlements Module: true once "Submit Bill" has locked this session's
  // bill into a Pending Settlement (see submitTableBill below).
  billSubmitted?: boolean;
  // Offers & Discounts Module: set only when the admin has manually applied
  // an offer to this session's bill (see applyOffer/removeOffer below).
  appliedOffer?: AppliedOffer | null;
}

export interface AppliedOffer {
  offerId: string;
  name: string;
  discountType: "flat" | "percentage";
  discountValue: number;
  discountAmount: number;
}

export interface ReceiptData {
  restaurant:
    | {
        name: string;
        address: string;
        phone: string;
        logo: string;
        gstNumber: string;
        /** Optional — only shown on the receipt when the backend supplies it. */
        email?: string;
        /** FSSAI license number, shown in the receipt header when present. */
        fssaiNumber?: string;
      }
    | null;
  table: { label: string };
  session: {
    sessionId: string;
    invoiceNumber: string | null;
    /** Same value as invoiceNumber — the customer-facing "Bill Number". */
    billNumber: string | null;
    /** "completed" once every non-cancelled order has been Served, else "in_progress"/null. */
    orderStatus: "completed" | "in_progress" | null;
    sessionStart: string;
    customerName: string;
    phoneNumber: string;
    paymentMethod: PaymentMethod | null;
    paymentStatus: PaymentStatus;
    transactionId: string | null;
    paidAt: string | null;
    billPrinted: boolean;
    printedAt: string | null;
    printedBy: string | null;
    printCount: number;
    /** Token/queue number for the order, when the restaurant uses one. Optional. */
    tokenNumber?: string | number | null;
    /** Offers & Discounts Module — mirrors TableSessionData.appliedOffer. */
    appliedOffer?: AppliedOffer | null;
  };
  cashierName: string;
  orders: {
    orderId: string;
    placedAt: string;
    status?: string;
    items: { name: string; price: number; quantity: number; modifiers?: SelectedOrderModifier[] }[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  }[];
  subtotal: number;
  gst: number;
  cgst?: number;
  sgst?: number;
  /** GST Management Module — always 0 today (every order is intra-state), modeled for future inter-state billing. */
  igst?: number;
  /** GST Management Module — the amount GST was actually calculated on; differs from subtotal only in Inclusive mode. */
  taxableAmount?: number;
  /** GST Management Module — false when GST Settings has GST turned off; the receipt should hide GST lines entirely in that case. */
  gstEnabled?: boolean;
  /** Bill-level discount, shown only when present and non-zero. Backend-authoritative — never recomputed on the receipt. */
  discount?: number;
  /** Rounding adjustment applied to grandTotal, shown only when present and non-zero. */
  roundOff?: number;
  grandTotal: number;
  generatedAt: string;
}

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";

export interface ReservationData {
  reservationId: string;
  restaurantId: string;
  tableId: string;
  customerName: string;
  phoneNumber: string;
  guestCount: number;
  reservationDate: string;
  reservationTime: string;
  expectedDuration: number;
  specialNotes: string;
  status: ReservationStatus;
  checkedInAt: string | null;
  completedAt: string | null;
}

export interface TableGridItem extends AdminTable {
  capacity: number;
  status: TableStatus;
  currentSessionId: string | null;
  currentReservationId: string | null;
  occupiedAt: string | null;
  activeSession: TableSessionData | null;
  activeReservation: ReservationData | null;
}

export interface TableAnalyticsData {
  counts: Record<TableStatus, number>;
  averageDiningDurationMinutes: number;
  averageTurnoverPerTable: number;
  mostUsedTables: { tableId: string; label: string; sessionCount: number }[];
  mostReservedTables: { tableId: string; label: string; reservationCount: number }[];
}

export async function fetchTableGrid(restaurantId: string): Promise<TableGridItem[]> {
  const res = await authFetch(`/api/admin/tables/${restaurantId}/grid`);
  const data = await handle<{ tables: TableGridItem[] }>(res);
  return data.tables;
}

export async function fetchTableDetails(
  tableId: string
): Promise<{ table: TableGridItem; activeSession: TableSessionData | null; activeReservation: ReservationData | null }> {
  const res = await authFetch(`/api/admin/tables/${tableId}/details`);
  return handle(res);
}

export async function fetchTableAnalytics(restaurantId: string): Promise<TableAnalyticsData> {
  const res = await authFetch(`/api/admin/tables/${restaurantId}/analytics`);
  return handle<TableAnalyticsData>(res);
}

// Manual-only: admin taps this when the customer asks for the bill.
export async function markTableBilling(tableId: string): Promise<AdminTable> {
  const res = await authFetch(`/api/admin/tables/${tableId}/billing`, { method: "PATCH" });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

// "Close Session": customer has paid and left -> ends session, table -> Cleaning.
export async function closeTableSession(tableId: string): Promise<AdminTable> {
  const res = await authFetch(`/api/admin/tables/${tableId}/close-session`, { method: "PATCH" });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

// Table Shifting (Transfer Table): moves the source table's active dining
// session onto `destinationTableId` — same session, same orders, same
// bill, just a different table. Returns the updated source (now
// Available), the updated destination (now Occupied), and the session
// itself (its tableId/tableToken now point at the destination).
export async function transferTableSession(
  sourceTableId: string,
  destinationTableId: string
): Promise<{ session: TableSessionData; sourceTable: AdminTable; destinationTable: AdminTable; message: string }> {
  const res = await authFetch(`/api/admin/tables/${sourceTableId}/transfer`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destinationTableId }),
  });
  return handle(res);
}

export async function markTableAvailable(tableId: string): Promise<AdminTable> {
  const res = await authFetch(`/api/admin/tables/${tableId}/available`, { method: "PATCH" });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

export async function markTableOutOfService(tableId: string): Promise<AdminTable> {
  const res = await authFetch(`/api/admin/tables/${tableId}/out-of-service`, { method: "PATCH" });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

export async function fetchSessionOrders(
  sessionId: string
): Promise<{ session: TableSessionData; orders: RecentOrder[] }> {
  const res = await authFetch(`/api/admin/table-sessions/${sessionId}/orders`);
  return handle(res);
}

// ---------- Current Dining Session: payment workflow ----------

export async function setSessionPaymentMethod(
  tableId: string,
  paymentMethod: PaymentMethod
): Promise<{ session: TableSessionData }> {
  const res = await authFetch(`/api/admin/tables/${tableId}/session/payment-method`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentMethod }),
  });
  return handle(res);
}

// Cash-only: marks the pre-payment bill as printed and returns the receipt
// payload to hand to the browser print dialog.
export async function printSessionBill(
  tableId: string
): Promise<{ session: TableSessionData; receipt: ReceiptData }> {
  const res = await authFetch(`/api/admin/tables/${tableId}/session/print-bill`, { method: "PATCH" });
  return handle(res);
}

export async function fetchSessionReceipt(tableId: string): Promise<{ receipt: ReceiptData }> {
  const res = await authFetch(`/api/admin/tables/${tableId}/session/receipt`);
  return handle(res);
}

export async function collectSessionPayment(
  tableId: string,
  transactionId?: string
): Promise<{ session: TableSessionData; table: AdminTable; receipt: ReceiptData }> {
  const res = await authFetch(`/api/admin/tables/${tableId}/session/collect-payment`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transactionId ? { transactionId } : {}),
  });
  return handle(res);
}

// ---------- Offers & Discounts: billing-time apply/remove ----------
// Manual-only, exactly one offer per bill — the admin picks an offer from
// the Billing popup's "Offers & Discounts" section. Both return the
// refreshed session + a recalculated receipt so the popup's Billing
// Summary can update immediately.

export async function applySessionOffer(
  tableId: string,
  offerId: string
): Promise<{ session: TableSessionData; receipt: ReceiptData }> {
  const res = await authFetch(`/api/admin/tables/${tableId}/session/apply-offer`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offerId }),
  });
  return handle(res);
}

export async function removeSessionOffer(
  tableId: string
): Promise<{ session: TableSessionData; receipt: ReceiptData }> {
  const res = await authFetch(`/api/admin/tables/${tableId}/session/remove-offer`, { method: "PATCH" });
  return handle(res);
}

// Settlements Module: "Submit Bill" — replaces "Close Session" in the
// Tables billing popup. Locks the bill and files it as a Pending
// Settlement without closing the session or freeing the table. See the
// full Settlements Module section further below for the rest of the
// workflow (list/collect/history/credits/analytics).
export async function submitTableBill(
  tableId: string
): Promise<{ table: AdminTable; session: TableSessionData; settlement: Settlement }> {
  const res = await authFetch(`/api/admin/tables/${tableId}/session/submit-bill`, { method: "PATCH" });
  return handle(res);
}

// ---------- Reservations ----------

export async function fetchReservations(
  restaurantId: string,
  params?: { date?: string; from?: string; to?: string }
): Promise<ReservationData[]> {
  const query = new URLSearchParams();
  if (params?.date) query.set("date", params.date);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const qs = query.toString();
  const res = await authFetch(`/api/admin/reservations/${restaurantId}${qs ? `?${qs}` : ""}`);
  const data = await handle<{ reservations: ReservationData[] }>(res);
  return data.reservations;
}

export async function createReservation(payload: {
  restaurantId: string;
  tableId: string;
  customerName: string;
  phoneNumber: string;
  guestCount: number;
  reservationDate: string;
  reservationTime: string;
  expectedDuration?: number;
  specialNotes?: string;
}): Promise<{ reservation: ReservationData; table: AdminTable }> {
  const res = await authFetch(`/api/admin/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function updateReservation(
  reservationId: string,
  updates: Partial<{
    customerName: string;
    phoneNumber: string;
    guestCount: number;
    reservationDate: string;
    reservationTime: string;
    expectedDuration: number;
    specialNotes: string;
    tableId: string;
  }>
): Promise<ReservationData> {
  const res = await authFetch(`/api/admin/reservations/${reservationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ reservation: ReservationData }>(res);
  return data.reservation;
}

export async function cancelReservation(reservationId: string): Promise<ReservationData> {
  const res = await authFetch(`/api/admin/reservations/${reservationId}`, { method: "DELETE" });
  const data = await handle<{ reservation: ReservationData }>(res);
  return data.reservation;
}

export async function checkInReservation(
  reservationId: string
): Promise<{ reservation: ReservationData; session: TableSessionData; table: AdminTable }> {
  const res = await authFetch(`/api/admin/reservations/${reservationId}/check-in`, {
    method: "POST",
  });
  return handle(res);
}

export async function markReservationNoShow(reservationId: string): Promise<ReservationData> {
  const res = await authFetch(`/api/admin/reservations/${reservationId}/no-show`, {
    method: "POST",
  });
  const data = await handle<{ reservation: ReservationData }>(res);
  return data.reservation;
}

// ---------- Staff ----------

export interface AdminStaff {
  id: string;
  restaurantId: string;
  name: string;
  role: "admin" | "kitchen" | "waiter";
  email: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export async function fetchAdminStaff(restaurantId: string): Promise<AdminStaff[]> {
  const res = await authFetch(`/api/admin/staff/${restaurantId}`);
  const data = await handle<{ staff: AdminStaff[] }>(res);
  return data.staff;
}

export async function createAdminStaff(payload: {
  restaurantId: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AdminStaff> {
  const res = await authFetch(`/api/admin/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ staff: AdminStaff }>(res);
  return data.staff;
}

export async function updateAdminStaff(
  staffId: string,
  updates: Partial<{ name: string; role: string; email: string; phone: string; isActive: boolean; password: string }>
): Promise<AdminStaff> {
  const res = await authFetch(`/api/admin/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ staff: AdminStaff }>(res);
  return data.staff;
}

export async function deleteAdminStaff(staffId: string): Promise<void> {
  const res = await authFetch(`/api/admin/staff/${staffId}`, { method: "DELETE" });
  await handle(res);
}

// ---------- Offers & Discounts ----------
// Admin-managed catalog of Flat/Percentage offers (Dashboard -> Offers &
// Discounts). Purely a catalog CRUD here — applying/removing an offer on a
// specific bill is handled separately by applySessionOffer/removeSessionOffer
// above (Tables & QR -> Billing popup).

export interface Offer {
  id: string;
  restaurantId: string;
  name: string;
  discountType: "flat" | "percentage";
  discountValue: number;
  minOrderAmount: number;
  isActive: boolean;
  createdAt: string;
}

export async function fetchAdminOffers(restaurantId: string): Promise<Offer[]> {
  const res = await authFetch(`/api/admin/offers/${restaurantId}`);
  const data = await handle<{ offers: Offer[] }>(res);
  return data.offers;
}

export async function createAdminOffer(payload: {
  restaurantId: string;
  name: string;
  discountType: "flat" | "percentage";
  discountValue: number;
  minOrderAmount?: number;
}): Promise<Offer> {
  const res = await authFetch(`/api/admin/offers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ offer: Offer }>(res);
  return data.offer;
}

export async function updateAdminOffer(
  offerId: string,
  updates: Partial<{
    name: string;
    discountType: "flat" | "percentage";
    discountValue: number;
    minOrderAmount: number;
    isActive: boolean;
  }>
): Promise<Offer> {
  const res = await authFetch(`/api/admin/offers/${offerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ offer: Offer }>(res);
  return data.offer;
}

export async function deleteAdminOffer(offerId: string): Promise<void> {
  const res = await authFetch(`/api/admin/offers/${offerId}`, { method: "DELETE" });
  await handle(res);
}

// ---------- Restaurant profile ----------

export interface RestaurantProfile {
  restaurantId: string;
  name: string;
  logo: string;
  description: string;
  address: string;
  phone: string;
  gstNumber?: string;
  theme: { primaryColor: string; secondaryColor: string };
}

export async function fetchRestaurantProfile(restaurantId: string): Promise<RestaurantProfile> {
  const res = await fetch(`${API_BASE_URL}/api/restaurants/${restaurantId}`, { cache: "no-store" });
  const data = await handle<{ restaurant: RestaurantProfile }>(res);
  return data.restaurant;
}

export async function updateRestaurantProfile(
  restaurantId: string,
  updates: Partial<RestaurantProfile>
): Promise<RestaurantProfile> {
  const res = await fetch(`${API_BASE_URL}/api/restaurants/${restaurantId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ restaurant: RestaurantProfile }>(res);
  return data.restaurant;
}

// ---------- Analytics ----------

export interface AnalyticsData {
  range: { from: string; to: string };
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  topItems: { id: string; name: string; quantitySold: number; revenue: number }[];
  dailyTotals: { date: string; revenue: number; orderCount: number }[];
}

export async function fetchAnalytics(
  restaurantId: string,
  from?: string,
  to?: string
): Promise<AnalyticsData> {
  const params = new URLSearchParams({ restaurantId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/api/orders/analytics?${params.toString()}`);
  return handle<AnalyticsData>(res);
}

export interface PeakHourData {
  hour: number; // 0-23
  orderCount: number;
  revenue: number;
}

export async function fetchPeakHours(
  restaurantId: string,
  from?: string,
  to?: string
): Promise<PeakHourData[]> {
  const params = new URLSearchParams({ restaurantId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/api/orders/analytics/peak-hours?${params.toString()}`);
  const data = await handle<{ hours: PeakHourData[] }>(res);
  return data.hours;
}

// ---------- Dashboard summary / revenue ----------

export interface DashboardSummary {
  todayRevenue: number;
  todayOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  activeTables: number;
  averageOrderValue: number;
}

export async function fetchDashboardSummary(restaurantId: string): Promise<DashboardSummary> {
  const res = await authFetch(`/api/admin/dashboard/summary?restaurantId=${restaurantId}`);
  return handle<DashboardSummary>(res);
}

export interface RevenueBreakdown {
  today: number;
  yesterday: number;
  weekly: number;
  monthly: number;
}

export async function fetchRevenueBreakdown(restaurantId: string): Promise<RevenueBreakdown> {
  const res = await authFetch(`/api/admin/dashboard/revenue?restaurantId=${restaurantId}`);
  return handle<RevenueBreakdown>(res);
}

// ---------- Customers ----------

export interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  firstVisit: string;
  lastVisit: string;
}

export async function fetchTopCustomers(restaurantId: string, limit = 10): Promise<TopCustomer[]> {
  const res = await authFetch(`/api/admin/customers/${restaurantId}?limit=${limit}`);
  const data = await handle<{ customers: TopCustomer[] }>(res);
  return data.customers;
}

export interface CustomerStats {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
}

export async function fetchCustomerStats(restaurantId: string): Promise<CustomerStats> {
  const res = await authFetch(`/api/admin/customers/${restaurantId}/stats`);
  return handle<CustomerStats>(res);
}

export async function fetchCustomerOrderHistory(
  restaurantId: string,
  phone: string
): Promise<{ customer: TopCustomer; orders: RecentOrder[] }> {
  const res = await authFetch(`/api/admin/customers/${restaurantId}/${phone}/orders`);
  return handle(res);
}

// ---------- Orders ----------
// Reuses the existing public/kitchen order-list endpoint (extended with
// optional search/date-range/limit params — see backend orderController).
export interface RecentOrder {
  orderId: string;
  tableLabel?: string | null;
  // Daily Token Number System: the dining session's token number, stamped
  // onto the order at creation time — see backend models/Order.js. Null
  // for takeaway/counter orders with no table session, or orders placed
  // before this feature existed.
  tokenNumber?: number | null;
  status: string;
  totalAmount: number;
  subtotal?: number;
  taxAmount?: number;
  orderType: "dine-in" | "takeaway";
  placedAt: string;
  customerName?: string;
  customerPhone?: string;
  specialInstructions?: string;
  items?: {
    // Item-Level Order Management: stable per-line id used to address this
    // exact item in updateOrderItemStatus below. Optional/possibly absent
    // on orders placed before this feature existed — see
    // orderItemLineKey(), which falls back to the item's array position.
    lineId?: string;
    item: { id: string; name: string; price: number; categoryTitle?: string };
    quantity: number;
    notes?: string;
    // Menu Item Customization (Modifiers): the selected sauce (or any
    // future modifier) for this exact line — absent/[] for a
    // non-customizable item, or any order placed before this feature
    // existed.
    modifiers?: SelectedOrderModifier[];
    // Defaults to "pending" on the backend for any line that predates this
    // field, so a missing value here should be treated the same way.
    status?: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  }[];
  orderSource?: "QR" | "ADMIN" | "WAITER" | "ONLINE" | "SWIGGY" | "ZOMATO";
  statusHistory?: { status: string; changedAt: string }[];
}

// Item-Level Order Management: the key to address one line with, for both
// display (React key) and the updateOrderItemStatus call below — the
// line's own lineId when present, or its array index for an order placed
// before lineId existed (see backend orderService.js:findOrderItemIndex,
// which accepts the same fallback).
export function orderItemLineKey(line: { lineId?: string }, index: number): string {
  return line.lineId || String(index);
}

export interface OrderFilters {
  status?: string; // comma-separated
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function fetchRecentOrders(
  restaurantId: string,
  filters: OrderFilters = {}
): Promise<RecentOrder[]> {
  const params = new URLSearchParams({ restaurantId });
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.limit) params.set("limit", String(filters.limit));

  const res = await fetch(`${API_BASE_URL}/api/orders?${params.toString()}`, { cache: "no-store" });
  const data = await handle<{ orders: RecentOrder[] }>(res);
  return data.orders;
}

export async function fetchOrderById(orderId: string): Promise<RecentOrder> {
  const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, { cache: "no-store" });
  const data = await handle<{ order: RecentOrder }>(res);
  return data.order;
}

// Permanent Order Deletion (Admin Dashboard -> Orders -> Delete). This is a
// hard delete — the order is removed from the database entirely, not
// cancelled/soft-deleted, and disappears from Orders/Analytics/Revenue/
// Reports/Settlements immediately. See backend controllers/adminOrderController.js.
export async function deleteAdminOrder(orderId: string): Promise<void> {
  const res = await authFetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
  await handle(res);
}

// Item-Level Order Management (Admin Dashboard -> Orders -> Order Details).
// Completes or cancels exactly one ordered item — every other item on the
// order is left untouched. The order's own status/subtotal/taxAmount/
// totalAmount/GST figures come back recomputed on the returned order; see
// backend services/orderService.js:updateOrderItemStatus.
export async function updateOrderItemStatus(
  orderId: string,
  lineId: string,
  status: "completed" | "cancelled"
): Promise<RecentOrder> {
  const res = await authFetch(`/api/admin/orders/${orderId}/items/${encodeURIComponent(lineId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await handle<{ order: RecentOrder }>(res);
  return data.order;
}

// ---------- Payments ----------

export interface PaymentMethodBreakdown {
  revenue: number;
  transactions: number;
  percentage: number; // 0-100
  averageBill: number;
}

export interface PaymentOverview {
  range: { from: string; to: string };
  totalRevenue: number;
  totalTransactions: number;
  averageBill: number;
  online: PaymentMethodBreakdown & {
    upi: { revenue: number; transactions: number };
    card: { revenue: number; transactions: number };
  };
  cash: PaymentMethodBreakdown;
}

export async function fetchPaymentOverview(
  restaurantId: string,
  from?: string,
  to?: string
): Promise<PaymentOverview> {
  const params = new URLSearchParams({ restaurantId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/api/admin/payments/overview?${params.toString()}`);
  return handle<PaymentOverview>(res);
}

export interface PaymentDailyPoint {
  date: string;
  onlineRevenue: number;
  cashRevenue: number;
  onlineCount: number;
  cashCount: number;
}

export async function fetchPaymentDailyBreakdown(
  restaurantId: string,
  from?: string,
  to?: string
): Promise<PaymentDailyPoint[]> {
  const params = new URLSearchParams({ restaurantId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/api/admin/payments/daily?${params.toString()}`);
  const data = await handle<{ days: PaymentDailyPoint[] }>(res);
  return data.days;
}

export interface PaymentTransaction {
  orderId: string;
  placedAt: string;
  tableLabel: string;
  customerName: string;
  amount: number;
  paymentMethod: "upi" | "cash" | "card";
  paymentStatus: "pending" | "paid";
  orderStatus: string;
}

export interface PaymentTransactionFilters {
  search?: string;
  method?: "online" | "cash" | "upi" | "card";
  status?: "paid" | "pending";
  from?: string;
  to?: string;
  sort?: "latest" | "highest" | "lowest";
  limit?: number;
}

export async function fetchPaymentTransactions(
  restaurantId: string,
  filters: PaymentTransactionFilters = {}
): Promise<PaymentTransaction[]> {
  const params = new URLSearchParams({ restaurantId });
  if (filters.search) params.set("search", filters.search);
  if (filters.method) params.set("method", filters.method);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.limit) params.set("limit", String(filters.limit));

  const res = await authFetch(`/api/admin/payments/transactions?${params.toString()}`);
  const data = await handle<{ transactions: PaymentTransaction[] }>(res);
  return data.transactions;
}

export interface PendingCashPayment {
  orderId: string;
  tableLabel: string;
  customerName: string;
  amount: number;
  placedAt: string;
}

export async function fetchPendingCashPayments(restaurantId: string): Promise<PendingCashPayment[]> {
  const res = await authFetch(`/api/admin/payments/pending-cash?restaurantId=${restaurantId}`);
  const data = await handle<{ pending: PendingCashPayment[] }>(res);
  return data.pending;
}

export async function collectCashPayment(orderId: string): Promise<void> {
  const res = await authFetch(`/api/admin/payments/${orderId}/collect`, { method: "PATCH" });
  await handle(res);
}

export interface PaymentSuccessMetrics {
  successful: number;
  failed: number;
  refunded: number;
  successfulPercentage: number;
  failedPercentage: number;
}

export async function fetchPaymentSuccessMetrics(
  restaurantId: string,
  from?: string,
  to?: string
): Promise<PaymentSuccessMetrics> {
  const params = new URLSearchParams({ restaurantId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await authFetch(`/api/admin/payments/success-metrics?${params.toString()}`);
  return handle<PaymentSuccessMetrics>(res);
}
// ---------- Settlements Module ----------
// Separates Billing (submitTableBill above) from Payment Collection
// (collectSettlement below). Mounted at /api/admin/settlements on the
// backend; see backend/src/controllers/settlementController.js.

export type SettlementPaymentMethod = "cash" | "upi" | "card" | "bank_transfer" | "credit";
export type SettlementPaymentStatus = "pending" | "paid" | "credit" | "cancelled";
/**
 * Payment Collection Tracking: how much of the bill has actually been
 * collected, independent of `paymentStatus` above (which is the workflow
 * state — pending/paid/credit/cancelled). A settlement can be "paid"
 * (workflow complete) while its collectionStatus is still PARTIALLY_PAID
 * or UNPAID — completing a settlement no longer requires the two to match.
 */
export type SettlementCollectionStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

// Split Payments: one line of the Payment Breakdown, e.g. { method: "cash", amount: 200 }.
export interface SettlementPaymentEntry {
  method: SettlementPaymentMethod;
  amount: number;
}

export interface Settlement {
  _id: string;
  settlementId: string;
  billNumber: string;
  restaurantId: string;
  orderIds: string[];
  sessionId: string;
  tableId: string;
  tableLabel: string;
  customerId: string | null;
  customerName: string;
  phoneNumber: string;
  subtotal: number;
  tax: number;
  /** Offers & Discounts Module — rupee amount deducted from this bill, if any. */
  discount?: number;
  /** Name of the offer applied at billing time, if any. */
  offerName?: string | null;
  grandTotal: number;
  /**
   * Payment Collection Tracking: how much has actually been collected
   * (excludes any Credit portion — that's a promise to pay later, tracked
   * separately via outstandingAmount), how much is still owed
   * (grandTotal - totalReceived; negative on an overpayment), and the
   * resulting PAID / PARTIALLY_PAID / UNPAID classification. All three are
   * 0 / grandTotal / "UNPAID" respectively until Collect Payment runs.
   */
  totalReceived: number;
  remainingAmount: number;
  collectionStatus: SettlementCollectionStatus;
  /**
   * Split Payments: the authoritative payment breakdown, e.g.
   * [{ method: "cash", amount: 200 }, { method: "upi", amount: 344 }].
   * Empty until Collect Payment completes.
   */
  paymentMethods: SettlementPaymentEntry[];
  /**
   * Legacy single-method convenience field — only set when the settlement
   * was paid via exactly one method; null for a genuine split (2+
   * methods) or before collection. Prefer `paymentMethods` everywhere.
   */
  paymentMethod: SettlementPaymentMethod | null;
  paymentStatus: SettlementPaymentStatus;
  receivedBy: string | null;
  remarks: string;
  settlementTime: string | null;
  dueDate: string | null;
  outstandingAmount: number;
  submittedAt: string;
  submittedBy: string | null;
}

export interface SettlementItem {
  name: string;
  price: number;
  quantity: number;
}

export interface SettlementFilters {
  search?: string;
  status?: SettlementPaymentStatus;
  method?: SettlementPaymentMethod;
  /** Payment Collection Tracking: filter by how much has been received, independent of workflow `status`. */
  collectionStatus?: SettlementCollectionStatus;
}

export async function fetchSettlements(
  restaurantId: string,
  filters: SettlementFilters = {}
): Promise<Settlement[]> {
  const params = new URLSearchParams({ restaurantId });
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.method) params.set("method", filters.method);
  if (filters.collectionStatus) params.set("collectionStatus", filters.collectionStatus);

  const res = await authFetch(`/api/admin/settlements?${params.toString()}`);
  const data = await handle<{ settlements: Settlement[] }>(res);
  return data.settlements;
}

export async function fetchSettlement(
  settlementId: string
): Promise<{ settlement: Settlement; items: SettlementItem[] }> {
  const res = await authFetch(`/api/admin/settlements/${settlementId}`);
  return handle(res);
}

// Fallback/direct equivalent of the Tables billing popup's "Submit Bill" —
// most callers should use submitTableBill instead.
export async function createSettlement(
  tableId: string
): Promise<{ table: AdminTable; session: TableSessionData; settlement: Settlement }> {
  const res = await authFetch(`/api/admin/settlements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tableId }),
  });
  return handle(res);
}

export interface CollectSettlementPayload {
  /** Split Payments: one or more { method, amount } lines that must sum to the bill's grandTotal. */
  paymentMethods: SettlementPaymentEntry[];
  receivedBy?: string;
  remarks?: string;
  dueDate?: string;
}

// "Complete Settlement" — finalizes payment (or records a Credit balance)
// and, either way, closes the dining session and frees the table.
export async function collectSettlement(
  settlementId: string,
  payload: CollectSettlementPayload
): Promise<{ settlement: Settlement; table: AdminTable | null; session: TableSessionData | null }> {
  const res = await authFetch(`/api/admin/settlements/${settlementId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export type SettlementHistoryRange = "today" | "yesterday" | "7d" | "30d" | "custom";
// Date-wise Collection & Settlement Reporting: superset of SettlementHistoryRange
// with "thisMonth" (calendar month-to-date), used by fetchDateWiseReport.
export type ReportRange = SettlementHistoryRange | "thisMonth";

export async function fetchSettlementHistory(
  restaurantId: string,
  range: SettlementHistoryRange = "today",
  from?: string,
  to?: string
): Promise<Settlement[]> {
  const params = new URLSearchParams({ restaurantId, range });
  if (range === "custom") {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  const res = await authFetch(`/api/admin/settlements/history?${params.toString()}`);
  const data = await handle<{ settlements: Settlement[] }>(res);
  return data.settlements;
}

export interface CreditCustomer {
  phoneNumber: string;
  customerName: string;
  outstandingBalance: number;
  lastVisit: string | null;
  dueDate: string | null;
  status: "pending" | "overdue";
}

export async function fetchCreditCustomers(restaurantId: string): Promise<CreditCustomer[]> {
  const res = await authFetch(`/api/admin/settlements/credits?restaurantId=${restaurantId}`);
  const data = await handle<{ customers: CreditCustomer[] }>(res);
  return data.customers;
}

export async function clearCreditBalance(
  restaurantId: string,
  phoneNumber: string,
  payload: { receivedBy?: string; remarks?: string } = {}
): Promise<{ cleared: number }> {
  const res = await authFetch(`/api/admin/settlements/credits/${encodeURIComponent(phoneNumber)}/clear`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, ...payload }),
  });
  return handle(res);
}

export interface SettlementAnalytics {
  range: { from: string; to: string };
  todaysSales: number;
  pendingCollection: number;
  cashCollected: number;
  onlinePayments: number;
  /** Payment-method breakdown (Dashboard cards). Subsets of onlinePayments above. */
  upiCollected: number;
  cardCollected: number;
  creditCustomers: number;
  /** Payment Collection Tracking: how many completed settlements in range fall into each bucket. */
  collectionSummary: {
    paid: number;
    partiallyPaid: number;
    unpaid: number;
    outstandingFromPartialOrUnpaid: number;
  };
  reports: {
    totalCashCollection: number;
    totalOnlineCollection: number;
    totalCreditOutstanding: number;
    pendingCollections: number;
    todaysRevenue: number;
    refunds: number;
    partialPayments: number;
    splitPayments: number;
  };
  /** Discount Tracking Module — same range as everything else above (today by default). */
  grossSales: number;
  totalDiscount: number;
  taxableAmount: number;
  gstCollected: number;
  netRevenue: number;
  offersUsed: OfferUsage[];
}

export interface OfferUsage {
  offerId: string | null;
  offerName: string;
  timesUsed: number;
  totalDiscount: number;
}

export async function fetchSettlementAnalytics(
  restaurantId: string,
  range: SettlementHistoryRange = "today",
  from?: string,
  to?: string
): Promise<SettlementAnalytics> {
  const params = new URLSearchParams({ restaurantId, range });
  if (range === "custom") {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  const res = await authFetch(`/api/admin/settlements/analytics?${params.toString()}`);
  return handle<SettlementAnalytics>(res);
}

// ---------- Date-wise Collection & Settlement Reporting (Settlements -> Reports) ----------

export interface DateWiseReportFilters {
  method?: SettlementPaymentMethod;
  status?: SettlementPaymentStatus;
  collectionStatus?: SettlementCollectionStatus;
}

export interface DailyCollectionRow {
  date: string; // "YYYY-MM-DD", Asia/Kolkata business date
  bills: number;
  cash: number;
  upi: number;
  card: number;
  onlinePayments: number;
  creditPending: number;
  discounts: number;
  totalSales: number;
}

export interface DateWiseReportSummary {
  totalSales: number;
  totalBills: number;
  cashCollected: number;
  upiCollected: number;
  cardCollected: number;
  bankTransferCollected: number;
  onlineCollected: number;
  creditPending: number;
  totalDiscount: number;
}

export interface DateWiseReport {
  range: { from: string; to: string };
  filters: { method: SettlementPaymentMethod | null; status: SettlementPaymentStatus | null; collectionStatus: SettlementCollectionStatus | null };
  summary: DateWiseReportSummary;
  paymentMethodBreakdown: { cash: number; upi: number; card: number; bankTransfer: number; credit: number };
  dailyBreakdown: DailyCollectionRow[];
  transactions: Settlement[];
  transactionsTruncated: boolean;
}

export async function fetchDateWiseReport(
  restaurantId: string,
  range: ReportRange = "today",
  opts: { from?: string; to?: string } & DateWiseReportFilters = {}
): Promise<DateWiseReport> {
  const params = new URLSearchParams({ restaurantId, range });
  if (range === "custom") {
    if (opts.from) params.set("from", opts.from);
    if (opts.to) params.set("to", opts.to);
  }
  if (opts.method) params.set("method", opts.method);
  if (opts.status) params.set("status", opts.status);
  if (opts.collectionStatus) params.set("collectionStatus", opts.collectionStatus);

  const res = await authFetch(`/api/admin/settlements/reports?${params.toString()}`);
  return handle<DateWiseReport>(res);
}

// ---------- Stock Management ----------

export type IngredientUnit = "g" | "kg" | "ml" | "l" | "pcs" | "dozen" | "packet" | "box";
export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export interface Ingredient {
  id: string;
  restaurantId: string;
  name: string;
  category: string;
  quantity: number;
  unit: IngredientUnit;
  costPerUnit: number;
  minimumStock: number;
  supplierId: string | null;
  notes: string;
  status: StockStatus;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySummary {
  totalIngredients: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValue: number;
}

export interface IngredientFilters {
  search?: string;
  category?: string;
  status?: StockStatus;
  sort?: "newest" | "oldest" | "quantity" | "alphabetical";
}

export async function fetchIngredients(
  restaurantId: string,
  filters: IngredientFilters = {}
): Promise<Ingredient[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort) params.set("sort", filters.sort);

  const qs = params.toString();
  const res = await authFetch(`/api/admin/inventory/${restaurantId}${qs ? `?${qs}` : ""}`);
  const data = await handle<{ ingredients: Ingredient[] }>(res);
  return data.ingredients;
}

export async function fetchInventorySummary(restaurantId: string): Promise<InventorySummary> {
  const res = await authFetch(`/api/admin/inventory/${restaurantId}/summary`);
  return handle<InventorySummary>(res);
}

export async function fetchStockAlerts(restaurantId: string): Promise<Ingredient[]> {
  const res = await authFetch(`/api/admin/inventory/${restaurantId}/alerts`);
  const data = await handle<{ alerts: Ingredient[] }>(res);
  return data.alerts;
}

export interface StockMovement {
  _id: string;
  restaurantId: string;
  ingredientId: string;
  ingredientName: string;
  type: "added" | "updated" | "purchased" | "deducted" | "deleted";
  quantityChange: number;
  resultingQuantity: number;
  note: string;
  performedBy: string;
  createdAt: string;
}

export async function fetchStockMovements(restaurantId: string, limit = 100): Promise<StockMovement[]> {
  const res = await authFetch(`/api/admin/inventory/${restaurantId}/movements?limit=${limit}`);
  const data = await handle<{ movements: StockMovement[] }>(res);
  return data.movements;
}

export async function createIngredient(payload: {
  restaurantId: string;
  name: string;
  category: string;
  quantity: number;
  unit: IngredientUnit;
  costPerUnit: number;
  minimumStock: number;
  supplierId?: string;
  notes?: string;
}): Promise<Ingredient> {
  const res = await authFetch(`/api/admin/inventory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ ingredient: Ingredient }>(res);
  return data.ingredient;
}

export async function updateIngredient(
  restaurantId: string,
  ingredientId: string,
  updates: Partial<{
    name: string;
    category: string;
    quantity: number;
    unit: IngredientUnit;
    costPerUnit: number;
    minimumStock: number;
    supplierId: string | null;
    notes: string;
  }>
): Promise<Ingredient> {
  const res = await authFetch(`/api/admin/inventory/${restaurantId}/${ingredientId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ ingredient: Ingredient }>(res);
  return data.ingredient;
}

export async function deleteIngredient(restaurantId: string, ingredientId: string): Promise<void> {
  const res = await authFetch(`/api/admin/inventory/${restaurantId}/${ingredientId}`, { method: "DELETE" });
  await handle(res);
}

// ---------- Purchases / Restock ----------

export interface PurchaseRecord {
  _id: string;
  restaurantId: string;
  ingredientId: string;
  ingredientName: string;
  supplierId: string | null;
  supplierName: string;
  quantity: number;
  unit: string;
  cost: number;
  purchaseDate: string;
  addedBy: string;
}

export async function createPurchase(payload: {
  restaurantId: string;
  ingredientId: string;
  quantity: number;
  cost: number;
  supplierId?: string;
}): Promise<{ ingredient: Ingredient; purchase: PurchaseRecord }> {
  const res = await authFetch(`/api/admin/inventory/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function fetchPurchaseHistory(restaurantId: string, limit = 200): Promise<PurchaseRecord[]> {
  const res = await authFetch(`/api/admin/inventory/${restaurantId}/purchases?limit=${limit}`);
  const data = await handle<{ purchases: PurchaseRecord[] }>(res);
  return data.purchases;
}

// ---------- Suppliers ----------

export interface Supplier {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
}

export async function fetchSuppliers(restaurantId: string): Promise<Supplier[]> {
  const res = await authFetch(`/api/admin/suppliers/${restaurantId}`);
  const data = await handle<{ suppliers: Supplier[] }>(res);
  return data.suppliers;
}

export async function createSupplier(payload: {
  restaurantId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}): Promise<Supplier> {
  const res = await authFetch(`/api/admin/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ supplier: Supplier }>(res);
  return data.supplier;
}

export async function updateSupplier(
  restaurantId: string,
  supplierId: string,
  updates: Partial<{ name: string; phone: string; email: string; address: string; notes: string }>
): Promise<Supplier> {
  const res = await authFetch(`/api/admin/suppliers/${restaurantId}/${supplierId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ supplier: Supplier }>(res);
  return data.supplier;
}

export async function deleteSupplier(restaurantId: string, supplierId: string): Promise<void> {
  const res = await authFetch(`/api/admin/suppliers/${restaurantId}/${supplierId}`, { method: "DELETE" });
  await handle(res);
}

// ---------- Recipe Mapping ----------

export interface RecipeLine {
  ingredientId: string;
  ingredientName: string;
  quantityPerUnit: number;
  unit: string;
}

export interface Recipe {
  _id: string;
  restaurantId: string;
  menuItemId: string;
  menuItemName: string;
  ingredients: RecipeLine[];
}

export async function fetchRecipes(restaurantId: string): Promise<Recipe[]> {
  const res = await authFetch(`/api/admin/recipes/${restaurantId}`);
  const data = await handle<{ recipes: Recipe[] }>(res);
  return data.recipes;
}

export async function fetchRecipe(restaurantId: string, menuItemId: string): Promise<Recipe | null> {
  const res = await authFetch(`/api/admin/recipes/${restaurantId}/${menuItemId}`);
  const data = await handle<{ recipe: Recipe | null }>(res);
  return data.recipe;
}

export async function saveRecipe(
  restaurantId: string,
  menuItemId: string,
  ingredients: { ingredientId: string; quantityPerUnit: number }[]
): Promise<Recipe> {
  const res = await authFetch(`/api/admin/recipes/${restaurantId}/${menuItemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients }),
  });
  const data = await handle<{ recipe: Recipe }>(res);
  return data.recipe;
}

// ---------- Admin Manual Ordering (Tables & QR -> Create Order) ----------
// Staff placing an order directly from the dashboard for walk-in / counter
// customers who didn't scan a QR code. Runs through the exact same
// order-creation pipeline as QR orders on the backend (see
// services/orderService.js) — table-occupancy sync, the Kitchen Dashboard
// broadcast, and everything downstream behaves identically, tagged with
// orderSource: "ADMIN".

export interface AdminOrderItemInput {
  id: string; // MenuItem.id
  quantity: number;
  notes?: string; // e.g. "No Onion", "Extra Cheese"
  // Menu Item Customization (Modifiers): mirrors PlaceOrderPayload's item
  // shape in lib/api.ts (Customer QR flow) exactly — validated server-side
  // by the same resolveLineModifiers()/validateAndBuildAdminOrder() used
  // for the customer flow, so a required group can't be skipped from
  // either flow. Omitted/undefined for a plain item.
  modifiers?: { groupId: string; optionIds: string[] }[];
}

export interface CreateAdminOrderPayload {
  orderType: "dine-in" | "takeaway";
  tableId?: string; // required when orderType === "dine-in"
  items: AdminOrderItemInput[];
  customerName?: string;
  customerPhone?: string;
  specialInstructions?: string;
}

export async function createAdminOrder(payload: CreateAdminOrderPayload): Promise<RecentOrder> {
  const res = await authFetch(`/api/admin/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ order: RecentOrder }>(res);
  return data.order;
}

// ---------- GST Management ----------
// Backs the GST Management sidebar item: GST Settings (business/statutory
// details, calculation mode, default %, slabs, enable/disable), the GST
// Dashboard (headline collected/payable figures) and GST Reports
// (Daily/Monthly/Custom breakdowns for Print/PDF/Excel export).

export interface GstSettings {
  restaurantId: string;
  businessName: string;
  gstin: string;
  businessAddress: string;
  calculationMode: "inclusive" | "exclusive";
  defaultGstPercentage: number;
  enabled: boolean;
  slabs: number[];
  // Future-ready — not yet applied to billing calculations (see backend
  // GstSettings model comments), surfaced here so the Settings UI can
  // still show/collect them ahead of that work.
  igstEnabled: boolean;
  stateCode: string;
  cessEnabled: boolean;
  defaultCessPercentage: number;
}

export async function fetchGstSettings(restaurantId: string): Promise<GstSettings> {
  const res = await authFetch(`/api/admin/gst/settings/${restaurantId}`);
  const data = await handle<{ settings: GstSettings }>(res);
  return data.settings;
}

export async function updateGstSettings(
  restaurantId: string,
  updates: Partial<GstSettings>
): Promise<GstSettings> {
  const res = await authFetch(`/api/admin/gst/settings/${restaurantId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ settings: GstSettings }>(res);
  return data.settings;
}

export interface GstDashboardData {
  range: { from: string | null; to: string | null };
  totalSales: number;
  taxableSales: number;
  gstCollected: number;
  cgstCollected: number;
  sgstCollected: number;
  igstCollected: number;
  inputTaxCredit: number;
  gstPayable: number;
  orderCount: number;
}

export async function fetchGstDashboard(
  restaurantId: string,
  range?: { from?: string; to?: string }
): Promise<GstDashboardData> {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const qs = params.toString();
  const res = await authFetch(`/api/admin/gst/dashboard/${restaurantId}${qs ? `?${qs}` : ""}`);
  const data = await handle<{ dashboard: GstDashboardData }>(res);
  return data.dashboard;
}

export interface GstReportRow {
  period: string;
  totalSales: number;
  taxableSales: number;
  cgstCollected: number;
  sgstCollected: number;
  igstCollected: number;
  gstCollected: number;
  orderCount: number;
}

export interface GstReportData {
  range: { from: string | null; to: string | null };
  groupBy: "day" | "month";
  rows: GstReportRow[];
  summary: Omit<GstReportRow, "period">;
}

export async function fetchGstReport(
  restaurantId: string,
  from: string,
  to: string,
  groupBy: "day" | "month" = "day"
): Promise<GstReportData> {
  const params = new URLSearchParams({ from, to, groupBy });
  const res = await authFetch(`/api/admin/gst/reports/${restaurantId}?${params.toString()}`);
  const data = await handle<{ report: GstReportData }>(res);
  return data.report;
}

// ---------- Investment & Expenses ----------
// Owner/Admin-only module: purchases (with Input GST), general business
// expenses, recurring bills, long-term assets, and vendors — plus an
// Overview dashboard, Input GST reports, Profit Analysis (vs. Order
// revenue), and exportable Daily/Weekly/Monthly/GST/Vendor/Purchase/
// Investment/P&L reports. See backend/src/routes/adminInvestmentRoutes.js.

export type InvestmentPaymentMethod = "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "pending";
export type InvestmentPaymentStatus = "paid" | "pending" | "partially_paid";
export type PurchaseGstType = "intra_state" | "inter_state";
export type PurchaseStatus = "draft" | "confirmed" | "cancelled";

export interface InvestmentVendor {
  id: string;
  restaurantId: string;
  name: string;
  gstNumber: string;
  phone: string;
  email: string;
  address: string;
  categories: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  purchaseCount?: number;
  totalPurchased?: number;
  outstandingBalance?: number;
}

export async function fetchInvestmentVendors(restaurantId: string, search?: string): Promise<InvestmentVendor[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await authFetch(`/api/admin/investment/vendors/${restaurantId}${qs}`);
  const data = await handle<{ vendors: InvestmentVendor[] }>(res);
  return data.vendors;
}

export async function fetchInvestmentVendorDetail(
  restaurantId: string,
  vendorId: string
): Promise<{ vendor: InvestmentVendor; purchases: InvestmentPurchase[]; expenses: InvestmentExpense[] }> {
  const res = await authFetch(`/api/admin/investment/vendors/${restaurantId}/${vendorId}`);
  return handle(res);
}

export async function createInvestmentVendor(payload: {
  restaurantId: string;
  name: string;
  gstNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  categories?: string[];
  notes?: string;
}): Promise<InvestmentVendor> {
  const res = await authFetch(`/api/admin/investment/vendors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ vendor: InvestmentVendor }>(res);
  return data.vendor;
}

export async function updateInvestmentVendor(
  restaurantId: string,
  vendorId: string,
  updates: Partial<{
    name: string;
    gstNumber: string;
    phone: string;
    email: string;
    address: string;
    categories: string[];
    notes: string;
  }>
): Promise<InvestmentVendor> {
  const res = await authFetch(`/api/admin/investment/vendors/${restaurantId}/${vendorId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ vendor: InvestmentVendor }>(res);
  return data.vendor;
}

export async function deleteInvestmentVendor(restaurantId: string, vendorId: string): Promise<void> {
  const res = await authFetch(`/api/admin/investment/vendors/${restaurantId}/${vendorId}`, { method: "DELETE" });
  await handle(res);
}

export interface InvestmentPurchase {
  id: string;
  restaurantId: string;
  branch: string;
  purchaseDate: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  vendorId: string | null;
  vendorName: string;
  vendorGstNumber: string;
  category: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  gstPercentage: number;
  gstType: PurchaseGstType;
  cgst: number;
  sgst: number;
  igst: number;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  paymentMethod: InvestmentPaymentMethod;
  paymentStatus: InvestmentPaymentStatus;
  status: PurchaseStatus;
  notes: string;
  invoiceUrl: string;
  stockIngredientId: string | null;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentPurchaseFilters {
  search?: string;
  category?: string;
  vendorId?: string;
  paymentMethod?: string;
  status?: string;
  paymentStatus?: string;
  gstPercentage?: number;
  invoiceNumber?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "amount_high" | "amount_low";
}

export interface Paginated<T> {
  pagination: { page: number; limit: number; total: number; totalPages: number };
  items: T[];
}

export async function fetchInvestmentPurchases(
  restaurantId: string,
  filters: InvestmentPurchaseFilters = {}
): Promise<{ purchases: InvestmentPurchase[]; pagination: Paginated<unknown>["pagination"] }> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  const res = await authFetch(`/api/admin/investment/purchases/${restaurantId}${qs ? `?${qs}` : ""}`);
  return handle(res);
}

export interface CreatePurchasePayload {
  restaurantId: string;
  branch?: string;
  purchaseDate?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  vendorId?: string;
  vendorName?: string;
  vendorGstNumber?: string;
  category: string;
  productName: string;
  quantity: number;
  unit?: string;
  rate: number;
  discount?: number;
  gstPercentage?: number;
  gstType?: PurchaseGstType;
  paymentMethod?: InvestmentPaymentMethod;
  paymentStatus?: InvestmentPaymentStatus;
  status?: PurchaseStatus;
  notes?: string;
  invoiceUrl?: string;
}

export async function createInvestmentPurchase(payload: CreatePurchasePayload): Promise<InvestmentPurchase> {
  const res = await authFetch(`/api/admin/investment/purchases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ purchase: InvestmentPurchase }>(res);
  return data.purchase;
}

export async function updateInvestmentPurchase(
  restaurantId: string,
  purchaseId: string,
  updates: Partial<CreatePurchasePayload>
): Promise<InvestmentPurchase> {
  const res = await authFetch(`/api/admin/investment/purchases/${restaurantId}/${purchaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ purchase: InvestmentPurchase }>(res);
  return data.purchase;
}

export async function deleteInvestmentPurchase(restaurantId: string, purchaseId: string): Promise<void> {
  const res = await authFetch(`/api/admin/investment/purchases/${restaurantId}/${purchaseId}`, { method: "DELETE" });
  await handle(res);
}

export interface InvestmentExpense {
  id: string;
  restaurantId: string;
  branch: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendorId: string | null;
  vendorName: string;
  paymentMethod: InvestmentPaymentMethod;
  paymentStatus: InvestmentPaymentStatus;
  invoiceUrl: string;
  notes: string;
  recurringExpenseId: string | null;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentExpenseFilters {
  search?: string;
  category?: string;
  vendorId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "amount_high" | "amount_low";
}

export async function fetchInvestmentExpenses(
  restaurantId: string,
  filters: InvestmentExpenseFilters = {}
): Promise<{ expenses: InvestmentExpense[]; pagination: Paginated<unknown>["pagination"] }> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  const res = await authFetch(`/api/admin/investment/expenses/${restaurantId}${qs ? `?${qs}` : ""}`);
  return handle(res);
}

export interface CreateExpensePayload {
  restaurantId: string;
  branch?: string;
  date?: string;
  category: string;
  description?: string;
  amount: number;
  vendorId?: string;
  vendorName?: string;
  paymentMethod?: InvestmentPaymentMethod;
  paymentStatus?: InvestmentPaymentStatus;
  invoiceUrl?: string;
  notes?: string;
}

export async function createInvestmentExpense(payload: CreateExpensePayload): Promise<InvestmentExpense> {
  const res = await authFetch(`/api/admin/investment/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ expense: InvestmentExpense }>(res);
  return data.expense;
}

export async function updateInvestmentExpense(
  restaurantId: string,
  expenseId: string,
  updates: Partial<CreateExpensePayload>
): Promise<InvestmentExpense> {
  const res = await authFetch(`/api/admin/investment/expenses/${restaurantId}/${expenseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ expense: InvestmentExpense }>(res);
  return data.expense;
}

export async function deleteInvestmentExpense(restaurantId: string, expenseId: string): Promise<void> {
  const res = await authFetch(`/api/admin/investment/expenses/${restaurantId}/${expenseId}`, { method: "DELETE" });
  await handle(res);
}

export async function fetchExpenseCategories(restaurantId: string): Promise<string[]> {
  const res = await authFetch(`/api/admin/investment/categories/${restaurantId}`);
  const data = await handle<{ categories: string[] }>(res);
  return data.categories;
}

export async function createExpenseCategory(restaurantId: string, name: string): Promise<{ id: string; name: string }> {
  const res = await authFetch(`/api/admin/investment/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, name }),
  });
  const data = await handle<{ category: { id: string; name: string } }>(res);
  return data.category;
}

export async function deleteExpenseCategory(restaurantId: string, categoryId: string): Promise<void> {
  const res = await authFetch(`/api/admin/investment/categories/${restaurantId}/${categoryId}`, { method: "DELETE" });
  await handle(res);
}

export interface RecurringExpense {
  id: string;
  restaurantId: string;
  name: string;
  category: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly";
  vendorId: string | null;
  vendorName: string;
  nextDueDate: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchRecurringExpenses(restaurantId: string): Promise<RecurringExpense[]> {
  const res = await authFetch(`/api/admin/investment/recurring/${restaurantId}`);
  const data = await handle<{ recurring: RecurringExpense[] }>(res);
  return data.recurring;
}

export async function createRecurringExpense(payload: {
  restaurantId: string;
  name: string;
  category: string;
  amount: number;
  frequency?: "weekly" | "monthly" | "yearly";
  vendorId?: string;
  vendorName?: string;
  nextDueDate: string;
  notes?: string;
}): Promise<RecurringExpense> {
  const res = await authFetch(`/api/admin/investment/recurring`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ recurring: RecurringExpense }>(res);
  return data.recurring;
}

export async function updateRecurringExpense(
  restaurantId: string,
  recurringId: string,
  updates: Partial<{
    name: string;
    category: string;
    amount: number;
    frequency: "weekly" | "monthly" | "yearly";
    nextDueDate: string;
    isActive: boolean;
    notes: string;
  }>
): Promise<RecurringExpense> {
  const res = await authFetch(`/api/admin/investment/recurring/${restaurantId}/${recurringId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ recurring: RecurringExpense }>(res);
  return data.recurring;
}

export async function deleteRecurringExpense(restaurantId: string, recurringId: string): Promise<void> {
  const res = await authFetch(`/api/admin/investment/recurring/${restaurantId}/${recurringId}`, { method: "DELETE" });
  await handle(res);
}

export async function recordRecurringExpensePayment(
  restaurantId: string,
  recurringId: string,
  paymentMethod?: InvestmentPaymentMethod
): Promise<{ expense: InvestmentExpense; recurring: RecurringExpense }> {
  const res = await authFetch(`/api/admin/investment/recurring/${restaurantId}/${recurringId}/record-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentMethod }),
  });
  return handle(res);
}

export interface InvestmentAsset {
  id: string;
  restaurantId: string;
  branch: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  vendorId: string | null;
  vendorName: string;
  warranty: string;
  expectedLifeYears: number;
  currentValue: number;
  invoiceUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchInvestmentAssets(
  restaurantId: string,
  filters: { search?: string; category?: string } = {}
): Promise<InvestmentAsset[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  const qs = params.toString();
  const res = await authFetch(`/api/admin/investment/assets/${restaurantId}${qs ? `?${qs}` : ""}`);
  const data = await handle<{ assets: InvestmentAsset[] }>(res);
  return data.assets;
}

export interface CreateAssetPayload {
  restaurantId: string;
  branch?: string;
  name: string;
  category?: string;
  purchaseDate?: string;
  purchaseCost: number;
  vendorId?: string;
  vendorName?: string;
  warranty?: string;
  expectedLifeYears?: number;
  currentValue?: number;
  invoiceUrl?: string;
  notes?: string;
}

export async function createInvestmentAsset(payload: CreateAssetPayload): Promise<InvestmentAsset> {
  const res = await authFetch(`/api/admin/investment/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ asset: InvestmentAsset }>(res);
  return data.asset;
}

export async function updateInvestmentAsset(
  restaurantId: string,
  assetId: string,
  updates: Partial<CreateAssetPayload>
): Promise<InvestmentAsset> {
  const res = await authFetch(`/api/admin/investment/assets/${restaurantId}/${assetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ asset: InvestmentAsset }>(res);
  return data.asset;
}

export async function deleteInvestmentAsset(restaurantId: string, assetId: string): Promise<void> {
  const res = await authFetch(`/api/admin/investment/assets/${restaurantId}/${assetId}`, { method: "DELETE" });
  await handle(res);
}

export async function uploadInvestmentInvoice(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("invoice", file);
  const res = await authFetch(`/api/admin/investment/upload`, { method: "POST", body: formData });
  const data = await handle<{ url: string }>(res);
  return data.url;
}

export interface InvestmentOverview {
  cards: {
    totalInvestment: number;
    totalExpenses: number;
    thisMonthExpenses: number;
    inputGstPaid: number;
    netBusinessCost: number;
    totalVendors: number;
    totalAssets: number;
    pendingPayments: number;
  };
  charts: {
    monthlyExpenseTrend: { month: string; total: number }[];
    categoryBreakdown: { category: string; total: number }[];
    vendorSpending: { vendor: string; total: number }[];
    monthlyProfit: { month: string; revenue: number; expenses: number; profit: number }[];
    monthlyGst: { month: string; total: number }[];
  };
}

export async function fetchInvestmentOverview(restaurantId: string): Promise<InvestmentOverview> {
  const res = await authFetch(`/api/admin/investment/overview/${restaurantId}`);
  return handle(res);
}

export interface InvestmentGstReportRow {
  period: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  inputGst: number;
  purchaseCount: number;
}

export async function fetchInvestmentGstReport(
  restaurantId: string,
  range: { from: string; to: string; groupBy?: "day" | "month" }
): Promise<{ from: string; to: string; rows: InvestmentGstReportRow[]; totals: Omit<InvestmentGstReportRow, "period"> }> {
  const params = new URLSearchParams({ from: range.from, to: range.to, groupBy: range.groupBy ?? "day" });
  const res = await authFetch(`/api/admin/investment/gst-report/${restaurantId}?${params.toString()}`);
  const data = await handle<{ report: { from: string; to: string; rows: InvestmentGstReportRow[]; totals: Omit<InvestmentGstReportRow, "period"> } }>(
    res
  );
  return data.report;
}

export interface ProfitAnalysis {
  from: string;
  to: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  profitMargin: number;
  expenseRatio: number;
}

export async function fetchProfitAnalysis(restaurantId: string, from: string, to: string): Promise<ProfitAnalysis> {
  const params = new URLSearchParams({ from, to });
  const res = await authFetch(`/api/admin/investment/profit-analysis/${restaurantId}?${params.toString()}`);
  const data = await handle<{ analysis: ProfitAnalysis }>(res);
  return data.analysis;
}

export type InvestmentReportType = "daily" | "weekly" | "monthly" | "gst" | "vendor" | "purchase" | "investment" | "pnl";

export interface InvestmentReportData {
  type: InvestmentReportType;
  from: string;
  to: string;
  columns: string[];
  rows: (string | number)[][];
}

export async function fetchInvestmentReport(
  restaurantId: string,
  params: { type: InvestmentReportType; from: string; to: string }
): Promise<InvestmentReportData> {
  const qs = new URLSearchParams({ type: params.type, from: params.from, to: params.to });
  const res = await authFetch(`/api/admin/investment/reports/${restaurantId}?${qs.toString()}`);
  const data = await handle<{ report: InvestmentReportData }>(res);
  return data.report;
}