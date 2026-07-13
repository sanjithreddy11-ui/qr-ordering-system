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
