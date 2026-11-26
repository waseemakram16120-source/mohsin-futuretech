# Mohsin FutureTech — Admin Guide

A short guide for the store owner. No technical background needed for the
day-to-day jobs.

## 1. Live mode (since 2026-11-25)

The store is **live on real Supabase** — no longer demo mode:

- **Live site:** https://mohsin-futuretech.vercel.app
- **Supabase project:** mohsin-futuretech, Singapore (ap-southeast-1),
  Healthy — https://nkabzgbzxpnuvoxqungc.supabase.co
- **Database:** 10 tables, 7 categories, 12 sample products, 41 variants,
  WELCOME10 coupon, buckets `product-images` (public) and
  `payment-receipts` (private)
- Orders, payments and admin changes now save to the real database.
  (If the Supabase keys were ever removed, the site falls back to demo
  mode — orders saved only in that browser, clearly labelled "Demo".)

## 2. Setup (one time) — ✅ done 2026-11-25

~~1. Create a project at https://supabase.com (Singapore is closest to
   Pakistan). Note the **Project URL** and keys.
2. In the Supabase Dashboard, open **SQL Editor → New query** and run
   these files from the project folder, **in this order**, each as its own
   query:
   1. `supabase/schema.sql`
   2. `supabase/policies.sql`
   3. `supabase/storage.sql`
   4. `supabase/seed.sql`
3. Check **Table Editor**: 7 categories, 12 sample products and the
   `WELCOME10` coupon should be there. Check **Storage**: buckets
   `product-images` and `payment-receipts` should exist.
4. In the live site (or locally), copy `.env.example` to `.env.local`
   and fill it from Supabase Dashboard → Project Settings → API:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` (server only — never share it).
5. On Vercel, add the same three values under Project → Settings →
   Environment Variables, then redeploy.
6. Set the payment accounts (see §7) and the delivery rules if they
   change.~~

Done: project created, all 4 SQL files run in order, keys added to
Vercel and redeployed (build fix: Next.js cacheComponents turned off,
layout forced live rendering). Verified live 2026-11-25: login page no
longer shows "not connected", product page shows real stock.
Still to do: §7 payment accounts and §3 first admin.

## 3. Make the first admin

1. Sign up on the website once with the admin's email
   (`/signup`).
2. In Supabase Dashboard → SQL Editor, run:
   ```sql
   update public.profiles set role = 'admin' where email = 'admin@example.com';
   ```
   Use the real admin email. Customers cannot change their own role —
   only this SQL (or another admin) can.
3. Log in at `/login`. Open `/admin` — you will see the dashboard.
   In demo mode anyone can open `/admin` to try it; once Supabase is
   connected, only admins can enter.

## 4. Daily jobs

### Dashboard (`/admin`)
Total orders, total sales, customers, products, pending orders, pending
payment verifications, low-stock count, today's orders/revenue, recent
orders and low-stock alerts.

### Orders (`/admin/orders`)
- Search by order number, customer name or phone. Filter by order
  status, payment status and payment method.
- Open an order to see customer details, delivery address, items
  (size / colour / SKU / price), totals and the payment evidence.
- **Update order status** using the buttons, following this order:
  Pending → Confirmed → Processing → Shipped → Delivered.
  Use Cancelled if the customer cancels, Returned if an item comes back.
- An EasyPaisa / JazzCash order should only be Confirmed **after** its
  payment is Approved (see §5).

### Payments (`/admin/payments`) — EasyPaisa / JazzCash
- Every submission shows: order number, customer, amount, Transaction
  ID and the receipt screenshot.
- Click the screenshot to view it full size.
- **Approve** — payment becomes Approved/Verified. If the order was
  Pending, it is Confirmed at the same time so it can proceed.
- **Reject** — you must write a reason. The payment becomes Rejected,
  the order stays on hold, and the customer can submit corrected
  evidence from their order page.
- **COD orders** appear in the same list as "Due on Delivery". After
  the rider collects the cash, click **Mark Paid**.

### Products (`/admin/products`)
- **Add product:** name, category, description, price, compare-at
  price (for a sale), product images (paste image URLs, one per line),
  Featured / New / Active, then add size / colour / stock / SKU
  variants. Save.
- **Edit product:** change price, description, images or variants.
- **Delete product:** use Delete and confirm. Deleted products no
  longer appear in the shop.
- Product photos: upload the photo to Supabase Storage
  (`product-images` bucket) or any image host, then paste the image
  URL into the product. Until real photos are added, the sample
  products use stock photos.

### Categories (`/admin/categories`)
Create or edit categories (Men, Women, Jackets, Jeans, Shirts,
Trousers, Accessories), change their order and switch them on/off.
Switching a category off hides it from the shop.

### Inventory (`/admin/inventory`)
Stock is tracked per size/colour variant. Variants with 5 or fewer
left are highlighted amber; 0 is red (out of stock) and customers
cannot order that variant. Use the + / − buttons or type a new stock
number. Stock is also reduced automatically when an order is placed
in live mode.

### Customers (`/admin/customers`)
Contacts, total orders and total spent per customer. Open a customer
to see their full order history.

### Reports (`/admin/reports`)
Daily / monthly summaries, order counts, revenue, pending orders,
average order value and best-selling products. Use the range filter:
Today, Last 7 days, Last 30 days, All time.

## 5. Money rules (do not change without asking the developer)

- **Delivery:** Rs 200 flat, free on orders of Rs 5,000 or more
  (after discount). Change in `src/lib/constants.ts`.
- **Coupon:** `WELCOME10` gives 10% off on orders of Rs 2,000 or more.
  Coupons live in the Supabase `coupons` table in live mode.
- **No automatic payment gateway.** EasyPaisa / JazzCash are always
  manual: the customer pays in their own app and submits proof; an
  admin must approve it. Never share the `SUPABASE_SERVICE_ROLE_KEY`.

## 6. Customer questions you may get

- *"Where is my order?"* — Ask for the order number (starts with
  `MF-`) and check `/admin/orders`, or tell them to use **Track Order**
  on the website with their order number and phone number.
- *"I paid but it still says Pending Verification."* — Check
  `/admin/payments` for their Transaction ID and approve or reject it.
- *"I want to change my address after ordering."* — Orders cannot be
  edited by the customer. Change the delivery address on the order
  detail page notes, or cancel and ask them to place a new order.

## 7. EasyPaisa / JazzCash account numbers

The numbers customers pay to are **not** stored in the code. Set them
as environment variables (Vercel → Project → Settings → Environment
Variables, or `.env.local` when running locally):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_EASYPAISA_ACCOUNT_NAME` | Account holder name |
| `NEXT_PUBLIC_EASYPAISA_ACCOUNT_NUMBER` | EasyPaisa number |
| `NEXT_PUBLIC_JAZZCASH_ACCOUNT_NAME` | Account holder name |
| `NEXT_PUBLIC_JAZZCASH_ACCOUNT_NUMBER` | JazzCash number |

Leave them blank until the real accounts are ready — the website then
shows "Account details to be added by the store owner" instead of a
wrong number. Never send account numbers in chat; only put them in
the environment variables above.

## 8. Going-live checklist

- [x] Supabase project created, SQL run, seed data checked (done 2026-11-25, live-verified)
- [ ] Real products, prices and photos added (replace the 12 samples)
- [ ] Real EasyPaisa / JazzCash numbers set
- [ ] WhatsApp number given to the developer (footer link)
- [ ] First admin account created (§3)
- [ ] One test order placed end-to-end: shop → cart → checkout →
      payment submission → admin approve → status to Delivered
- [ ] Delivery charges confirmed (Rs 200 / free above Rs 5,000)
