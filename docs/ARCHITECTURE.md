# Architecture

## System Architecture

Customer

↓

QR Code Scan

↓

Frontend (Next.js)

↓

Backend API (Express.js)

↓

PostgreSQL Database

---

Kitchen Staff

↓

Kitchen Dashboard

↓

Backend API

↓

Database

---

Restaurant Owner

↓

Admin Dashboard

↓

Backend API

↓

Database

---

## Frontend Architecture

Frontend Modules:

1. Customer Module

   * Menu
   * Cart
   * Checkout
   * Order Tracking

2. Kitchen Module

   * Active Orders
   * Order History

3. Admin Module

   * Dashboard
   * Menu Management
   * Categories
   * Analytics
   * QR Code Generation
   * Settings

---

## Backend Architecture

Request

↓

Routes

↓

Controllers

↓

Services

↓

Database

---

## Database Architecture

Restaurant

├── Tables

├── Categories

├── Foods

├── Orders

└── Users

---

## Real-Time Architecture

Customer Places Order

↓

Backend API

↓

Database

↓

Socket.IO Event

↓

Kitchen Dashboard Update

↓

Kitchen Staff Changes Status

↓

Customer Receives Updated Status
