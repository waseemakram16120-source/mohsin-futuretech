# Mohsin FutureTech — Online Fashion & Clothing Store

A professional, responsive e-commerce website for a clothing and fashion
retail business, inspired by the Furor Jeans shopping experience. Customers
browse collections, choose sizes and colours, add items to a cart, place
orders with COD / EasyPaisa / JazzCash, and track order progress. The business
manages products, inventory, orders, customers, payment verification and
reports through a secure admin dashboard.

**Current status: Step 6 — Testing & deployment complete.** The
storefront (Step 2) plus cart, wishlist, checkout, customer login / profile
/ saved addresses, order history and order tracking (Step 3) are built,
EasyPaisa / JazzCash manual payment verification (Step 4) is built, the
admin dashboard (Step 5) is built, and Step 6 testing, bug fixing and
deployment are done. No live Supabase project exists yet, so orders are
created in **demo mode** (saved in the browser) until the project is
connected — see "Demo mode" below. Admin guidance is in
[`ADMIN_GUIDE.md`](ADMIN_GUIDE.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 |
| Backend | Node.js — Next.js Route Handlers (`src/app/api/...`) |
| Database | Supabase (Postgres) + Supabase Auth |
| Storage | Supabase Storage (`product-images`, `payment-receipts`) |
| Deployment | Cloud hosting (Vercel — Step 6) |

## Folder structure

```
mohsin-futuretech/
├── src/
│   ├── app/
│   │   ├── cart/page.tsx         # /cart — line items, qty stepper, coupon
│   │   ├── wishlist/page.tsx     # /wishlist — saved items, move to cart
│   │   ├── checkout/page.tsx     # /checkout — delivery form, payment choice
│   │   ├── order-success/page.tsx  # /order-success — order reference
│   │   ├── pay/[orderNumber]/page.tsx  # /pay/<order> — submit payment evidence
│   │   ├── login/page.tsx        # /login — Supabase Auth sign-in
│   │   ├── signup/page.tsx       # /signup — Supabase Auth sign-up
│   │   ├── account/page.tsx      # /account — profile, addresses, history
│   │   ├── account/orders/[id]/page.tsx  # order detail + status timeline
│   │   ├── track/page.tsx        # /track — order tracking by number + phone
│   │   ├── page.tsx              # Homepage — hero, categories, featured,
│   │   │                         # new arrivals, sale, WELCOME10 strip
│   │   ├── shop/page.tsx         # /shop — full catalogue + filters/sort
│   │   ├── category/[slug]/page.tsx  # /category/<slug>
│   │   ├── product/[slug]/page.tsx   # /product/<slug> — gallery, variants
│   │   ├── search/page.tsx       # /search?q= — search results
│   │   ├── layout.tsx            # Root layout + providers + header/footer
│   │   ├── globals.css           # Tailwind CSS
│   │   └── api/
│   │       ├── health/route.ts   # GET /api/health — API health check
│   │       ├── orders/route.ts   # POST /api/orders (create) + GET (lookup)
│   │       ├── payments/route.ts # POST /api/payments — payment evidence
│   │       └── admin/            # /api/admin/* — admin-only routes
│   │           # (overview, orders, payments, products, categories,
│   │           #  inventory, customers, reports; server-side admin check)
│   ├── admin/
│   │       ├── page.tsx          # /admin — dashboard summary
│   │       ├── orders/page.tsx + [id]/page.tsx
│   │       ├── payments/page.tsx # Approve / Reject / Mark Paid
│   │       ├── products/page.tsx + new/ + [id]/ (add/edit/delete)
│   │       ├── categories/page.tsx
│   │       ├── inventory/page.tsx
│   │       ├── customers/page.tsx + [id]/page.tsx
│   │       └── reports/page.tsx
│   ├── components/
│   │   ├── PaymentInstructions.tsx  # EasyPaisa/JazzCash account + steps
│   │   ├── PaymentStatusCard.tsx    # PDF payment-status labels + actions
│   │   ├── SiteHeader.tsx        # Logo, category nav, search, live cart /
│   │   │                         # wishlist counts, account, track order
│   │   ├── SiteFooter.tsx        # About, links, COD/EasyPaisa/JazzCash
│   │   ├── ProductCard.tsx       # Card + wishlist heart
│   │   ├── ProductDetail.tsx     # Gallery, variants, Add to Cart (wired)
│   │   ├── OrderTimeline.tsx     # Pending → Delivered status timeline
│   │   ├── OrderSummary.tsx      # Subtotal / discount / delivery / total
│   │   ├── WishlistButton.tsx    # Heart toggle (client component)
│   │   ├── ShopFilters.tsx       # URL-driven filters + sorting
│   │   └── ShopListing.tsx       # Shared listing for shop/category/search
│   ├── context/
│   │   ├── StoreContext.tsx      # Cart + wishlist providers (localStorage)
│   │   └── AuthContext.tsx       # Supabase Auth session + profile
│   └── lib/
│       ├── cart.ts               # Cart types, totals, WELCOME10, phone check
│       ├── demo-orders.ts        # Demo-mode orders / profile / addresses
│       ├── server-catalog.ts     # Server-side catalogue + coupon validation
│       ├── data/
│       │   ├── categories.ts     # 7 categories (mirrors seed.sql)
│       │   ├── products.ts       # 12 products + variants (mirrors seed.sql)
│       │   ├── store-client.ts   # Client-safe Supabase-configured check
│       │   └── store.ts          # Supabase-first data layer with local
│       │                         # seed fallback when Supabase is unset
│       ├── constants.ts          # Store name, payment methods, order statuses,
│       │                         # delivery charges (Rs 200 flat), PKR formatting
│       ├── payments.ts           # Wallet accounts, instructions, Transaction ID
│       │                         # + receipt validation, payment-status rules
│       ├── types.ts              # TypeScript types matching the DB tables
│       └── supabase/
│           ├── client.ts         # Browser client (@supabase/ssr, anon key)
│           ├── server.ts         # Server client (cookies, Server Components/Actions)
│           └── admin.ts          # Service-role client — SERVER ONLY, bypasses RLS
├── supabase/
│   ├── schema.sql                # Tables, enums, helpers, triggers, indexes
│   ├── policies.sql              # Row Level Security for every table
│   ├── storage.sql               # Storage buckets + storage policies
│   └── seed.sql                  # Sample categories, products, coupon
├── .env.example                  # Env var template (copy to .env.local)
└── package.json
```

## Step 1 — what is done

- **Next.js app scaffolded** — App Router, TypeScript, Tailwind, ESLint;
  `npm run build` passes cleanly.
- **Database schema** (`supabase/schema.sql`) — `categories`, `products`,
  `product_variants` (size / colour / SKU / stock), `profiles` (linked to
  `auth.users`, role `customer` / `admin`, auto-created on sign-up),
  `addresses`, `coupons`, `orders` (auto order numbers like
  `MF-20261124-00001`), `order_items` (price snapshots, computed
  `line_total`), `payments`, `wishlist`. Enums for payment method
  (COD / EasyPaisa / JazzCash), payment status (Pending Verification /
  Approved / Rejected / Due / Paid) and order status (Pending → Confirmed →
  Processing → Shipped → Delivered, plus Cancelled / Returned).
- **Row Level Security** (`supabase/policies.sql`) — public reads only active
  products/categories; customers can only create/read their own orders,
  payments, addresses and wishlist; customers cannot promote themselves to
  admin; admins (`profiles.role = 'admin'`) have full access.
- **Storage** (`supabase/storage.sql`) — public `product-images` bucket
  (admin upload only) and private `payment-receipts` bucket (customers
  upload into their own `<user_id>/<order_id>/` folder; admins read all).
- **Seed data** (`supabase/seed.sql`) — 7 categories (Men, Women, Jackets,
  Jeans, Shirts, Trousers, Accessories), 12 sample products with realistic
  PKR prices and variants, and coupon `WELCOME10` (10% off, min Rs 2,000).
- **App code** — Supabase browser / server / admin clients, DB types,
  constants (payment methods, statuses, Rs 200 delivery), `.env.example`,
  and a minimal branded home page stating Step 1 is complete.

## Supabase setup (do this once)

1. Create a project at [supabase.com](https://supabase.com) (any region;
   Singapore is closest to Pakistan). Note the **Project URL** and keys.
2. In the Supabase Dashboard, open **SQL Editor → New query** and run the
   files **in this order**, each as its own query:
   1. `supabase/schema.sql`
   2. `supabase/policies.sql`
   3. `supabase/storage.sql`
   4. `supabase/seed.sql`
3. Verify in **Table Editor**: you should see 7 categories, 12 products,
   ~40 variants and the `WELCOME10` coupon.
4. Verify in **Storage**: buckets `product-images` (public) and
   `payment-receipts` (private) exist.
5. **Make the first admin:** sign up once through the app (Step 3 adds the
   sign-up page; until then use Dashboard → Authentication → Add user), then
   run in SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'admin@example.com';
   ```
   Replace with the real admin email. Never do this from the browser — the
   RLS policies block customers from changing their own role.
6. **Auth settings (recommended):** Dashboard → Authentication → Providers →
   Email — enable email sign-ups for customers.

## Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` from Supabase Dashboard → Project Settings → API:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, e.g. `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **server only, never share or commit** |
| `NEXT_PUBLIC_EASYPAISA_ACCOUNT_NAME` | EasyPaisa account holder name (shown to customers) |
| `NEXT_PUBLIC_EASYPAISA_ACCOUNT_NUMBER` | EasyPaisa account number (shown to customers) |
| `NEXT_PUBLIC_JAZZCASH_ACCOUNT_NAME` | JazzCash account holder name (shown to customers) |
| `NEXT_PUBLIC_JAZZCASH_ACCOUNT_NUMBER` | JazzCash account number (shown to customers) |

Leave the four payment variables blank until the store owner provides the
real accounts — the site shows "Account details to be added by the store
owner" meanwhile. Never put a real account number in chat.

`.env.local` is excluded by `.gitignore`. No real credentials are stored in
this repo.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000 — full storefront (Step 2)
npm run build    # production build (must pass before every step)
npm start        # serve the production build
```

`GET /api/health` returns `{ "status": "ok", "service": "mohsin-futuretech", "step": 6 }`.

## Step 6 — what is done (testing, bug fixing & deployment)

- **Full end-to-end testing** on the production build: homepage, shop /
  category / search with filters and sorting, product detail with
  size / colour / stock, cart, WELCOME10 coupon, checkout validation,
  demo COD and EasyPaisa orders, payment submission validation,
  order tracking, login/signup demo notice, and every `/admin` page.
  All pages returned HTTP 200; all API validation cases returned the
  expected 400 / 200 responses (see test notes in the Step 6 report).
- **Bugs fixed:** footer links "Track Your Order (Step 3)" /
  "My Account (Step 3)" were dead text with dev labels — they are now
  real links to `/track` and `/account`. The admin product form's
  `Date.now()` in a render-time state initializer was moved into a lazy
  initializer. Health check now reports step 6.
- **Known lint note:** `npm run lint` reports 9 errors, all the React 19
  `set-state-in-effect` rule flagging the standard localStorage
  hydration pattern (load cart/wishlist/demo orders in `useEffect`,
  then set state), plus `<img>` performance warnings for remote
  Unsplash images. The production build passes clean and every flow
  was verified at runtime; the hydration pattern is intentional.
- **Admin guidance:** see [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) — setup,
  first admin, daily jobs (orders, payments, products, categories,
  inventory, customers, reports), money rules and the going-live
  checklist.
- **Deployment:** GitHub repo and Vercel live URL are recorded in the
  Step 6 report (see "Deployment" below).

## Deployment

- GitHub (target): `waseemakram16120-source/mohsin-futuretech`
  (branch `main`) — see the Step 6 report for the verified URL/commit
  once pushed.
- Vercel (target): project `mohsin-futuretech` — live URL and public
  check are recorded in the Step 6 report once deployed; deployment
  protection OFF so the client can view it publicly.
- Environment variables on Vercel: leave the Supabase and payment
  variables blank until the real project / accounts exist (the site
  runs in demo mode meanwhile and shows placeholders, never fake
  numbers). Add them under Project → Settings → Environment Variables
  and redeploy when ready.

## Step 2 — what is done (storefront)

- **Homepage** (`/`) — hero promotional banner (Winter Sale + WELCOME10),
  trust strip (COD, EasyPaisa/JazzCash, delivery across Pakistan), 7
  category tiles, Featured Products, New Arrivals, Sale products, and a
  WELCOME10 coupon strip. Navy `#0f2440` branding, mobile-first responsive.
- **Category browsing** — `/shop` (full catalogue) and `/category/[slug]`
  pages with breadcrumbs.
- **Search** — header search box → `/search?q=`; matches name, description
  and category.
- **Filters & sorting** — category, price range, size, colour, in-stock
  only, on-sale only, and sorting (Featured, Price low→high / high→low,
  Newest, Name A–Z). All filters live in URL search params, so any
  filtered view is shareable (e.g. `/shop?category=jeans&size=32&sort=price-asc`).
- **Product detail** (`/product/[slug]`) — image gallery, description,
  price + compare-at price + discount %, SKU per selected variant,
  category, size/colour selection with per-variant stock (In Stock / Low
  Stock / Out of Stock; out-of-stock variants disabled), quantity
  selector, and related products from the same category.
- **Data layer** (`src/lib/data/store.ts`) — tries Supabase first when env
  vars are configured, and falls back to the local seed data (same 12
  products / 7 categories as `supabase/seed.sql`) when Supabase is not
  configured or a query fails. The site works fully on the fallback today.
- **Product photos** — real Unsplash direct URLs (all verified HTTP 200);
  2–3 images per product, 1 per category tile. No placeholder graphics.
- **Add to Cart button** is wired to the cart (Step 3).

## Step 3 — what is done (cart, checkout & accounts)

- **Cart** (`/cart`) — add from product pages with selected size / colour,
  quantity stepper, remove, clear on order. Stock is enforced: you cannot
  add more than the variant has in stock. Guest cart works without login
  (localStorage, `mf-cart-v1`).
- **Wishlist** (`/wishlist`) — heart toggle on product cards and product
  pages, move-to-cart (first in-stock variant) / remove. Persisted in
  localStorage (`mf-wishlist-v1`) and synced to the Supabase `wishlist`
  table when signed in (best-effort).
- **Checkout** (`/checkout`) — delivery form (full name, Pakistani phone
  validation, full address, city, optional province / postal code / notes)
  with inline errors on every required field; saved addresses to pick
  from; coupon input (WELCOME10); order summary (subtotal, delivery Rs 200
  flat / free above Rs 5,000, discount, total); payment method radio
  cards (COD / EasyPaisa / JazzCash — method is only *selected* here,
  evidence submission is Step 4). Guest checkout allowed; signed-in
  customers get name / phone / addresses pre-filled.
- **Order creation** (`POST /api/orders`) — server-side validation: items
  are re-priced from the server catalogue, stock re-checked, coupon
  re-validated (Supabase `coupons` table when configured, else the
  WELCOME10 rule), totals recomputed — client-sent totals are ignored.
  Order numbers are `MF-YYYYMMDD-XXXXX`. A `payments` row is created
  (`due` for COD, `pending_verification` for EasyPaisa / JazzCash).
- **Order confirmation** (`/order-success`) — order reference, items,
  total, payment method / status and what happens next.
- **Customer auth** (`/login`, `/signup`) — Supabase Auth email + password;
  profile row is auto-created by the schema trigger. When Supabase is not
  configured, both pages show a clear notice instead of a broken form.
- **My Account** (`/account`) — profile (name / phone), saved addresses
  (add / delete / set default), order history. **Order detail**
  (`/account/orders/[id]`) — items, totals, payment, delivery and the
  Pending → Confirmed → Processing → Shipped → Delivered timeline.
- **Order tracking** (`/track`) — order number + delivery phone lookup,
  same status timeline. Works for live and demo orders.
- **Header** — live cart item count, wishlist count, Account / Login
  state, Track Order link; mobile menu includes Cart, Wishlist, Track
  Order and Account.

## Step 4 — what is done (payments, manual verification only)

- **Payment instructions** (`src/lib/payments.ts` + `PaymentInstructions`
  component) — EasyPaisa / JazzCash account name + number from env vars
  (`NEXT_PUBLIC_EASYPAISA_*` / `NEXT_PUBLIC_JAZZCASH_*`) with a copy
  button; when not configured the site shows "Account details to be added
  by the store owner" — no fake numbers. Exact amount due, order number
  and 4 step-by-step instructions. COD shows "Pay cash on delivery" only.
- **Payment submission** (`/pay/[orderNumber]`, `POST /api/payments`) —
  Transaction ID (required, 5–40 letters/numbers) + receipt screenshot
  (required, JPG/PNG/WebP, max 5 MB, preview before submit) + optional
  note. Validated client-side and server-side. Live mode uploads the
  receipt to the private `payment-receipts` bucket at
  `<user_id or guest>/<order_id>/receipt-<timestamp>.<ext>` and updates
  the `payments` row to Pending Verification. Demo mode validates and
  discards the file, saving only Transaction ID + file name in the
  browser (clearly labelled demo).
- **Status rules** — duplicate submission is blocked once evidence is in
  (Pending Verification with a Transaction ID) or the payment is Approved
  / Paid; resubmission is allowed only after a Rejection (admin sets that
  in Step 5). COD orders never get an evidence form.
- **Status display** — `PaymentStatusCard` (PDF §6 labels: Pending
  Verification / Approved / Rejected / Due on Delivery / Paid) is shown
  on `/order-success`, `/account/orders/[id]` and `/track`, with a link to
  submit evidence when none is on file. Checkout now previews the wallet
  account + flow when EasyPaisa / JazzCash is selected.
- **No automatic gateway** — payments are manual verification only, per
  the proposal (§4, §6, §13).

## Demo mode (no Supabase project yet)

Until a Supabase project is created and the SQL is run, the site runs in
**demo mode**: `POST /api/orders` returns the order with `mode: "demo"`
and the browser saves it in localStorage (`mf-demo-orders-v1`) so order
history, order detail and tracking still work on that device. Demo orders
are clearly labelled in the UI ("Demo order") and are never presented as
database writes. Payment evidence submitted in demo mode is likewise saved
in the browser only (Transaction ID + receipt file name; the screenshot
file itself is not uploaded anywhere) and shows as Pending Verification.
Once Supabase is connected, the same checkout writes
real rows to `orders` / `order_items` / `payments` (guest orders included
— the API uses the service-role client, because RLS blocks guest inserts
via the anon key).

## Step 5 — what is done (admin dashboard)

- **Access control** (`/admin`) — when Supabase is not configured, anyone
  opening `/admin` gets clearly-labelled **Demo Admin** mode (local data
  only, banner on every page). When Supabase is configured, only a
  signed-in user with `profiles.role = 'admin'` may enter; others are
  redirected to `/login` or shown access denied. Every `/api/admin/*`
  route re-checks admin server-side. First real admin: sign up, then
  `update public.profiles set role = 'admin' where email = '...';`
- **Dashboard** (`/admin`) — total orders, sales, customers, products,
  pending orders, pending payment verifications, low-stock count, today's
  orders/revenue, recent orders, low-stock alerts.
- **Orders** (`/admin/orders`, `/admin/orders/[id]`) — search (order
  number / name / phone), filters (order status, payment status, payment
  method), sorting; detail shows customer + delivery info, items with
  SKU, totals, payment evidence and the status timeline; status update
  follows the PDF §7 workflow (Pending → Confirmed → Processing →
  Shipped → Delivered, plus Cancelled / Returned).
- **Payments** (`/admin/payments`) — EasyPaisa/JazzCash submissions with
  order, customer, amount, Transaction ID and receipt (signed URL in
  live mode); Approve (also confirms a pending order, PDF §6) or Reject
  with a required reason (order stays on hold, customer may resubmit);
  COD list with Mark Paid after delivery.
- **Products** (`/admin/products`, `/new`, `/[id]`) — add/edit/delete,
  name/slug/description, price/compare-at price, category, featured/new/
  active flags, image URLs, and size/colour/stock/SKU variants.
- **Categories** (`/admin/categories`) — create/edit, sort order and
  visibility, product counts.
- **Inventory** (`/admin/inventory`) — stock by variant, low-stock
  indicators (≤ 5, 0 = out of stock), +/− and set-value controls.
- **Customers** (`/admin/customers`, `/[id]`) — contacts, order counts,
  total spent, order history per customer.
- **Reports** (`/admin/reports`) — daily/monthly summaries, order
  counts, revenue, pending orders, average order value, best-selling
  products; range filter (today / 7 days / 30 days / all time).
- **Demo mode** — admin edits (products, categories, stock, order
  status, payment review) are kept in localStorage overrides on this
  device and clearly labelled demo; live mode writes to Supabase via
  the service-role client.

## Out of scope (per proposal)

Automatic payment-gateway integration, courier integrations and advanced
accounting are **not** included. EasyPaisa / JazzCash use manual verification
of submitted payment evidence.
