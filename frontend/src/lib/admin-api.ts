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
}

export interface ReceiptData {
  restaurant: { name: string; address: string; phone: string; logo: string; gstNumber: string } | null;
  table: { label: string };
  session: {
    sessionId: string;
    invoiceNumber: string | null;
    sessionStart: string;
    customerName: string;
    phoneNumber: string;
    paymentMethod: PaymentMethod | null;
    paymentStatus: PaymentStatus;
    transactionId: string | null;
    paidAt: string | null;
  };
  cashierName: string;
  orders: {
    orderId: string;
    placedAt: string;
    items: { name: string; price: number; quantity: number }[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  }[];
  subtotal: number;
  gst: number;
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
  status: string;
  totalAmount: number;
  subtotal?: number;
  taxAmount?: number;
  orderType: "dine-in" | "takeaway";
  placedAt: string;
  customerName?: string;
  customerPhone?: string;
  specialInstructions?: string;
  items?: { item: { id: string; name: string; price: number }; quantity: number }[];
  statusHistory?: { status: string; changedAt: string }[];
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
