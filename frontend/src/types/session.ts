export interface SessionInfo {
  sessionId: string;
  restaurantId: string;
  restaurantSlug: string;
  tableToken: string;
  expiresAt: string; // ISO timestamp
}

export interface RestaurantTheme {
  primaryColor: string;
  secondaryColor: string;
}

export interface Restaurant {
  restaurantId: string;
  name: string;
  logo: string;
  description: string;
  address: string;
  phone: string;
  theme: RestaurantTheme;
}
