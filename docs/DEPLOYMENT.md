# Deployment

## Frontend Deployment

Platform:

Vercel

Responsibilities:

* Customer UI
* Kitchen Dashboard
* Admin Dashboard

---

## Backend Deployment

Platform:

Railway

Responsibilities:

* API Server
* Authentication
* Business Logic
* Socket.IO

---

## Database Deployment

Platform:

Neon PostgreSQL

Responsibilities:

* Restaurant Data
* Orders
* Users
* Food Items
* Categories

---

## Environment Variables

Frontend:

NEXT_PUBLIC_API_URL=

---

Backend:

PORT=

DATABASE_URL=

JWT_SECRET=

FRONTEND_URL=

---

## Deployment Flow

Developer

↓

GitHub

↓

Frontend → Vercel

↓

Backend → Railway

↓

Database → Neon PostgreSQL
