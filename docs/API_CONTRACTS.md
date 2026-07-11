# API Contracts

## Authentication APIs

### Admin Login

POST /api/auth/login

Request:

{
"email": "[owner@example.com](mailto:owner@example.com)",
"password": "password"
}

Response:

{
"success": true,
"token": "jwt_token",
"role": "ADMIN"
}

---

## Customer APIs

### Get Restaurant Menu

GET /api/menu/:restaurantId

Response:

{
"restaurant": {},
"categories": [],
"foods": []
}

---

### Create Order

POST /api/orders

Request:

{
"tableNumber": 5,
"items": [
{
"foodId": 1,
"quantity": 2
}
]
}

Response:

{
"success": true,
"orderId": 101
}

---

### Get Order Status

GET /api/orders/:orderId

Response:

{
"orderId": 101,
"status": "PREPARING"
}

---

## Kitchen APIs

### Get Active Orders

GET /api/kitchen/orders

Response:

{
"orders": []
}

---

### Update Order Status

PUT /api/kitchen/orders/:id

Request:

{
"status": "READY"
}

Response:

{
"success": true
}

---

## Admin APIs

### Get Dashboard Data

GET /api/admin/dashboard

Response:

{
"todayRevenue": 5000,
"todayOrders": 45,
"activeOrders": 8
}

---

### Add Food Item

POST /api/admin/foods

---

### Update Food Item

PUT /api/admin/foods/:id

---

### Delete Food Item

DELETE /api/admin/foods/:id

---

### Generate QR Code

POST /api/admin/qr-codes

---

### Get Analytics

GET /api/admin/analytics
