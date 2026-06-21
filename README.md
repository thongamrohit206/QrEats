# 🍽️ QR Code Based Food Ordering System

A complete restaurant/shop ordering system: customers scan a QR code at their table,
browse the live menu, place an order with special instructions, and pay — no waiting
for a waiter. Shop owners get an admin dashboard to manage the menu and track orders
in real time (Placed → Preparing → Ready → Delivered).

## ✨ Features

- **Sign up / Login** for restaurant/shop admins (secure password hashing + JWT auth)
- **Unique QR code** auto-generated per shop, linking straight to that shop's digital menu
- **Admin dashboard**: add/edit/delete menu items with photo, price, category; hide/show items
- **Order management**: view incoming orders, update status (placed → preparing → ready → delivered), cancel orders
- **Customer ordering**: scan QR → browse menu → add to cart → checkout
- **Comments / special requests** field on every order (e.g. "less spicy", "no onions")
- **Payment step** at checkout (simulated — see "Adding Real Payments" below)
- **Live order status tracking page** for customers (auto-refreshes)
- **Stats dashboard** (menu item count, total orders, pending orders)

## 🗂️ Project Structure

```
food-ordering-system/
├── server.js              # Express app entry point
├── db.js                  # Lightweight JSON file datastore (no native build needed)
├── routes/
│   ├── auth.js             # signup, login, QR code generation
│   ├── items.js             # menu item CRUD + public menu endpoint
│   ├── orders.js             # place order, track order, admin order management
│   └── shop.js               # shop profile + stats
├── middleware/
│   └── auth.js              # JWT auth guard
├── public/
│   ├── index.html            # landing page
│   ├── signup.html / login.html
│   ├── admin.html / admin.js  # admin dashboard
│   ├── menu.html / menu.js    # customer-facing menu & ordering (opened via QR)
│   ├── order-status.html      # live order tracking page for customers
│   ├── style.css
│   ├── uploads/                # uploaded food photos
│   └── qrcodes/                # generated QR code images, one per shop
└── data/app.json            # JSON datastore (auto-created on first run)
```

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Edit `.env`:
```
PORT=3000
JWT_SECRET=replace_with_a_long_random_secret
BASE_URL=http://localhost:3000
```
**Important:** `BASE_URL` is embedded into every generated QR code. When you deploy
to a real server/domain, update this to your public URL (e.g. `https://yourshop.com`)
and existing shops can regenerate their QR via the admin dashboard.

### 3. Run the server
```bash
npm start
```
Visit `http://localhost:3000`

### 4. Try it out
1. Go to **Sign Up**, register your restaurant (you get a unique shop ID + QR code automatically).
2. You're logged into the **Admin Dashboard** — add a few menu items with photos and prices.
3. Download/print the QR code shown on the dashboard and place it on your tables.
4. Open the **menu link** shown under the QR (or scan the QR with a phone) — this opens the
   customer ordering page for your shop.
5. Add items to cart, fill in table number / comments, and place the order (payment step is simulated).
6. Back in the admin dashboard's **Orders** tab, you'll see the order — move it through
   Preparing → Ready → Delivered. The customer's tracking page updates automatically.

## 🧾 How the QR Code Works

Each shop's QR code encodes a URL like:
```
http://yourdomain.com/menu.html?shop=<shopId>
```
Scanning it opens that shop's live menu directly — no app install needed, just a phone camera/browser.
You can optionally add `&table=T5` to the URL (and print a different QR per table) so the
table number is automatically pre-filled at checkout.

## 💳 Adding Real Payments

Right now checkout simulates a payment (1.2s delay, then marks the order as paid) so you can
test the full flow without any payment gateway keys. To go live, integrate a real gateway:

- **Razorpay** (popular in India, supports UPI/Cards/Netbanking) or **Stripe** (global)
- Typical flow: when "Pay & Place Order" is clicked, call your backend to create a payment order,
  open the gateway's checkout (Razorpay Checkout.js / Stripe Elements), then on success call the
  existing `POST /api/orders` endpoint to record the order with `payment_status: "paid"`.
- Replace the simulated `setTimeout` in `public/menu.js` (`placeOrderBtn` click handler) with
  the real gateway SDK calls.

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | – | Register a new shop/admin account |
| POST | `/api/auth/login` | – | Login, returns JWT |
| GET | `/api/auth/qrcode/:shopId` | – | Get/regenerate a shop's QR code |
| GET | `/api/items/public/:shopId` | – | Get available menu items for customers |
| GET | `/api/items` | ✅ | Get all items for the logged-in shop |
| POST | `/api/items` | ✅ | Add a menu item (multipart form, supports `photo`) |
| PUT | `/api/items/:id` | ✅ | Update a menu item |
| DELETE | `/api/items/:id` | ✅ | Delete a menu item |
| POST | `/api/orders` | – | Customer places an order |
| GET | `/api/orders/track/:orderId` | – | Customer tracks an order's status |
| GET | `/api/orders` | ✅ | Admin: list all orders (optional `?status=`) |
| PUT | `/api/orders/:id/status` | ✅ | Admin: update order status |
| GET | `/api/shop/me` | ✅ | Admin: shop profile + stats |

`✅` = requires `Authorization: Bearer <token>` header (JWT from login/signup).

## 🛠️ Notes on the Datastore

This project ships with a simple JSON-file datastore (`db.js` + `data/app.json`) so it
runs anywhere with zero native build steps. For production use with concurrent traffic,
swap `db.js` for a real database (PostgreSQL, MySQL, MongoDB, or SQLite via `better-sqlite3`)
— the rest of the code calls a small set of functions (`createShop`, `findItemsByShop`, etc.)
so the swap only touches `db.js`.

## 📌 Possible Next Steps

- Real payment gateway integration (Razorpay/Stripe)
- WebSockets/SSE instead of polling for instant order status updates
- Per-table QR codes with auto-filled table numbers
- Order history & analytics for shop owners
- Multi-language menu support
- SMS/WhatsApp notifications when order status changes
