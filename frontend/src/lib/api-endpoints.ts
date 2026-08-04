import { API_BASE_URL } from "@/lib/config";

export const API_ENDPOINTS = {
  menu: (restaurantId: string) => `${API_BASE_URL}/api/menu/${restaurantId}`,
  orders: () => `${API_BASE_URL}/api/orders`,
  order: (orderId: string) => `${API_BASE_URL}/api/orders/${orderId}`,
  orderStatus: (orderId: string) => `${API_BASE_URL}/api/orders/${orderId}/status`,
  ordersByRestaurant: (restaurantId: string, status?: string) =>
    `${API_BASE_URL}/api/orders?restaurantId=${restaurantId}${
      status ? `&status=${status}` : ""
    }`,
  ordersBySession: (sessionId: string) => `${API_BASE_URL}/api/orders/session/${sessionId}`,
  sessions: () => `${API_BASE_URL}/api/sessions`,
  sessionStatus: (sessionId: string) => `${API_BASE_URL}/api/sessions/${sessionId}`,
  restaurant: (restaurantId: string) => `${API_BASE_URL}/api/restaurants/${restaurantId}`,
  paymentsCreateOrder: () => `${API_BASE_URL}/api/payments/create-order`,
  paymentsVerify: () => `${API_BASE_URL}/api/payments/verify`,
};
