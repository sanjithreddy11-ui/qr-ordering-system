// This app is single-tenant: it serves exactly one restaurant (Maxibrew),
// so the restaurant is no longer part of the URL. This constant is the one
// place that identifies "which restaurant" for API calls that still expect
// a restaurantId (session creation, menu fetch, etc). If this project ever
// needs to serve multiple restaurants again, this is the value to make
// dynamic (e.g. read from an env var or a subdomain) instead of the old
// `[restaurantId]` URL segment.
export const RESTAURANT_ID = "maxibrew";
