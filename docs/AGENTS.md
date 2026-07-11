# AGENTS

## Project Name

SmartQR Platform

---

## Frontend Stack

* Next.js
* TypeScript
* Tailwind CSS
* Zustand
* TanStack Query
* Framer Motion
* Lucide React
* React Hook Form
* Zod
* Sonner

---

## Backend Stack

* Node.js
* Express.js
* TypeScript
* Prisma ORM
* PostgreSQL
* Socket.IO
* JWT Authentication
* bcrypt

---

## Development Rules

Frontend:

* Use App Router
* Use functional components
* Avoid class components
* Use reusable UI components
* Keep services separate from components

Backend:

* Follow:

Route

↓

Controller

↓

Service

↓

Database

* Validate every request
* Keep business logic inside services
* Use middleware for authentication

---

## Folder Rules

Frontend:

components/

services/

store/

constants/

lib/

Backend:

routes/

controllers/

services/

middlewares/

validators/

utils/

socket/

---

## Documentation Rules

Whenever a major feature is added:

* Update API_CONTRACTS.md
* Update DATABASE_DESIGN.md
* Update REQUIREMENTS.md if necessary
