// Backend base URL. Set NEXT_PUBLIC_API_URL in a `.env.local` file at your
// Next.js project root for production; falls back to localhost for dev.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
