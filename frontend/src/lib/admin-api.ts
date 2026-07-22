import { API_BASE_URL } from "@/lib/config";

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body as T;
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
  isAvailable: boolean;
}

export async function fetchAdminMenuItems(restaurantId: string): Promise<AdminMenuItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/admin/menu/${restaurantId}`, { cache: "no-store" });
  const data = await handle<{ items: AdminMenuItem[] }>(res);
  return data.items;
}

export async function createAdminMenuItem(payload: Partial<AdminMenuItem>): Promise<AdminMenuItem> {
  const res = await fetch(`${API_BASE_URL}/api/admin/menu`, {
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
  const res = await fetch(`${API_BASE_URL}/api/admin/menu/${restaurantId}/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ item: AdminMenuItem }>(res);
  return data.item;
}

export async function deleteAdminMenuItem(restaurantId: string, itemId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/menu/${restaurantId}/${itemId}`, {
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
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${restaurantId}`, { cache: "no-store" });
  const data = await handle<{ tables: AdminTable[] }>(res);
  return data.tables;
}

export async function createAdminTable(restaurantId: string, label: string): Promise<AdminTable> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tables`, {
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
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${tableId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

export async function deleteAdminTable(tableId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${tableId}`, { method: "DELETE" });
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
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${restaurantId}/grid`, { cache: "no-store" });
  const data = await handle<{ tables: TableGridItem[] }>(res);
  return data.tables;
}

export async function fetchTableDetails(
  tableId: string
): Promise<{ table: TableGridItem; activeSession: TableSessionData | null; activeReservation: ReservationData | null }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${tableId}/details`, { cache: "no-store" });
  return handle(res);
}

export async function fetchTableAnalytics(restaurantId: string): Promise<TableAnalyticsData> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${restaurantId}/analytics`, { cache: "no-store" });
  return handle<TableAnalyticsData>(res);
}

// Manual-only: admin taps this when the customer asks for the bill.
export async function markTableBilling(tableId: string): Promise<AdminTable> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${tableId}/billing`, { method: "PATCH" });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

// "Close Session": customer has paid and left -> ends session, table -> Cleaning.
export async function closeTableSession(tableId: string): Promise<AdminTable> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${tableId}/close-session`, { method: "PATCH" });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

export async function markTableAvailable(tableId: string): Promise<AdminTable> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${tableId}/available`, { method: "PATCH" });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

export async function markTableOutOfService(tableId: string): Promise<AdminTable> {
  const res = await fetch(`${API_BASE_URL}/api/admin/tables/${tableId}/out-of-service`, { method: "PATCH" });
  const data = await handle<{ table: AdminTable }>(res);
  return data.table;
}

export async function fetchSessionOrders(
  sessionId: string
): Promise<{ session: TableSessionData; orders: RecentOrder[] }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/table-sessions/${sessionId}/orders`, { cache: "no-store" });
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
  const res = await fetch(`${API_BASE_URL}/api/admin/reservations/${restaurantId}${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
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
  const res = await fetch(`${API_BASE_URL}/api/admin/reservations`, {
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
  const res = await fetch(`${API_BASE_URL}/api/admin/reservations/${reservationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ reservation: ReservationData }>(res);
  return data.reservation;
}

export async function cancelReservation(reservationId: string): Promise<ReservationData> {
  const res = await fetch(`${API_BASE_URL}/api/admin/reservations/${reservationId}`, { method: "DELETE" });
  const data = await handle<{ reservation: ReservationData }>(res);
  return data.reservation;
}

export async function checkInReservation(
  reservationId: string
): Promise<{ reservation: ReservationData; session: TableSessionData; table: AdminTable }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/reservations/${reservationId}/check-in`, {
    method: "POST",
  });
  return handle(res);
}

export async function markReservationNoShow(reservationId: string): Promise<ReservationData> {
  const res = await fetch(`${API_BASE_URL}/api/admin/reservations/${reservationId}/no-show`, {
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
  const res = await fetch(`${API_BASE_URL}/api/admin/staff/${restaurantId}`, { cache: "no-store" });
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
  const res = await fetch(`${API_BASE_URL}/api/admin/staff`, {
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
  const res = await fetch(`${API_BASE_URL}/api/admin/staff/${staffId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handle<{ staff: AdminStaff }>(res);
  return data.staff;
}

export async function deleteAdminStaff(staffId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/staff/${staffId}`, { method: "DELETE" });
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
  const res = await fetch(`${API_BASE_URL}/api/orders/analytics?${params.toString()}`, {
    cache: "no-store",
  });
  return handle<AnalyticsData>(res);
}

// ---------- Recent orders (overview page) ----------
// Reuses the existing public/kitchen order-list endpoint — no new backend
// route needed, since it already supports listing all statuses.
export interface RecentOrder {
  orderId: string;
  tableLabel?: string | null;
  status: string;
  totalAmount: number;
  orderType: "dine-in" | "takeaway";
  placedAt: string;
}

export async function fetchRecentOrders(restaurantId: string): Promise<RecentOrder[]> {
  const res = await fetch(`${API_BASE_URL}/api/orders?restaurantId=${restaurantId}`, {
    cache: "no-store",
  });
  const data = await handle<{ orders: RecentOrder[] }>(res);
  return data.orders;
}
