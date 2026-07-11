# SmartQR Backend

Express + Socket.io + MongoDB backend for the QR ordering system.

## 1. Set up MongoDB Atlas (free)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free "M0" cluster (any region close to you).
3. Under **Database Access**, create a database user with a username/password.
4. Under **Network Access**, add IP `0.0.0.0/0` (allow from anywhere) — fine for development.
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/`

## 2. Install and configure

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and paste your MongoDB URI into `MONGODB_URI`, replacing `<username>` and `<password>`.

## 3. Seed the menu

This loads the same menu items your frontend mock data already has, plus 3 demo tables.

```bash
npm run seed
```

## 4. Run the server

```bash
npm run dev
```

You should see:
```
MongoDB connected: smartqr
SmartQR backend running on http://localhost:5000
Accepting requests from: http://localhost:3000
```

## API summary

| Method | Route                            | Purpose                                          |
|--------|-----------------------------------|---------------------------------------------------|
| GET    | `/api/restaurants/:restaurantId`  | Cafe info for the landing page                     |
| POST   | `/api/sessions`                   | Create a customer session (call on landing page load) |
| GET    | `/api/sessions/:sessionId`        | Check if a session is still valid                  |
| GET    | `/api/menu/:restaurantId`         | Get menu grouped by category                       |
| POST   | `/api/orders`                     | Place an order (requires `sessionId`)               |
| GET    | `/api/orders/:orderId`            | Get one order (order-success page)                  |
| GET    | `/api/orders?restaurantId=...`    | List orders (kitchen dashboard)                     |
| GET    | `/api/orders/session/:sessionId`  | This session's orders, split into `active`/`past`   |
| PATCH  | `/api/orders/:orderId/status`     | Update order status (kitchen dashboard)             |

## Sessions

A session represents one customer's visit, starting the moment they land
on the cafe's page (from the QR scan) and lasting `SESSION_TTL_HOURS`
(default 3, set in `.env`). Every order is tagged with the `sessionId` that
placed it. The Active Orders / Past Orders tabs only ever show orders for
the current browser's session — never other customers' orders, even at the
same table.

## Socket.io events

- Client emits `join-kitchen` with `restaurantId` → joins that kitchen's room.
- Client emits `join-order` with `orderId` → joins that order's room.
- Client emits `join-session` with `sessionId` → joins that session's room (for the Active Orders tab).
- Server emits `new-order` (to kitchen room + session room) when an order is placed.
- Server emits `order-status-updated` (to kitchen room + order room + session room) on status change.
