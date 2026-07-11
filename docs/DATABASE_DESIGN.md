# Database Design

## Restaurants Table

Fields:

* id
* name
* address
* phone
* email
* createdAt

---

## Tables Table

Fields:

* id
* restaurantId
* tableNumber
* qrCode

---

## Categories Table

Fields:

* id
* restaurantId
* name

---

## Foods Table

Fields:

* id
* categoryId
* name
* description
* price
* image
* isAvailable

---

## Orders Table

Fields:

* id
* restaurantId
* tableId
* status
* totalAmount
* createdAt

Order Status:

* PENDING
* PREPARING
* READY
* DELIVERED

---

## OrderItems Table

Fields:

* id
* orderId
* foodId
* quantity
* price

---

## Users Table

Fields:

* id
* restaurantId
* name
* email
* password
* role

User Roles:

* ADMIN
* KITCHEN

---

## Relationships

Restaurant

→ Categories

→ Foods

→ Tables

→ Orders

→ Users

Order

→ OrderItems

Food

→ Category

Table

→ Restaurant

User

→ Restaurant
