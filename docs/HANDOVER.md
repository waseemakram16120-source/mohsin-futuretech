# Project handover — Mohsin FutureTech online store

Client: **Muhammad Waseem** (Mohsin FutureTech, Korangi Industrial Area, Karachi)
Built from: [`docs/proposal.pdf`](proposal.pdf)
Code: GitHub `waseemakram16120-source/mohsin-futuretech` — pull request #1
(branch `claude/compassionate-archimedes-ftdeig`).

---

## 1. What is delivered — proposal checklist

| Proposal section | Delivered |
|---|---|
| §2 Customer website | Homepage with banners and featured collections; Men / Women and Jackets, Jeans, Shirts, Trousers, Accessories; product photos, descriptions, prices, sizes, colours, SKU and live stock; search, filters (price, size, colour, stock, sale) and sorting; New arrivals, Featured, Sale; coupons; bag and wishlist; registration, login, password reset, profile, saved addresses, order history, order tracking; WhatsApp link. |
| §3 Cart & checkout | Add / change quantity / remove; size + colour with availability; subtotal, delivery charge (free above a set amount), coupon discount; name, phone and full address with validation; payment method; order number and confirmation page. Prices and stock are re-checked on the server. |
| §4 Payments (customer) | Cash on Delivery ("COD — Due"); EasyPaisa and JazzCash with the store's account details, Transaction ID + receipt screenshot upload, **Pending Verification** until an admin reviews it. Manual verification, as agreed (no automatic gateway). |
| §5 Admin dashboard | Summary (orders, sales, customers, products, pending, recent activity); products (add / edit / archive, **photo upload**, prices, categories, sizes, colours, variants, stock); categories (create, edit, order, show/hide); orders (details, customer, items, delivery, search / filter, status updates); customers (contacts, profiles, order history); inventory (stock per size/colour, low-stock alerts, + / − adjustments with history); reports (daily / monthly, order counts, revenue, pending orders, best sellers, CSV). |
| §6 Payment approval | Queue of EasyPaisa / JazzCash submissions with Transaction ID, screenshot, order and customer; Approve (order moves to Confirmed) or Reject with a reason the customer sees; COD "Mark as paid"; every review recorded (who, when, note). |
| §7 Order workflow | Pending → Confirmed → Processing → Shipped → Delivered, plus Cancelled / Returned (stock returned automatically); full history. |
| §8 Workflow | All 10 steps tested end to end, automatically, on desktop and phone. |
| §9 Technology | Next.js (React) + Node.js server routes, Supabase (database, login, file storage), responsive design, cloud hosting on Vercel. |
| §10 Security & performance | Protected admin access, database access rules on every table, validation everywhere, private receipt storage, security headers, Lighthouse 99–100 on desktop; tested at 360–1440 px. Backups: see `DEPLOYMENT.md` §9. |
| §11 Deliverables | Website, admin, payment workflow, reports, database setup, deployment guide, testing, admin guidance — all in this repository. |
| **Extra (requested later)** | **Live chat** between customers and the store (Admin → Messages). |
| Extra (included) | Order tracking without an account, wishlist across devices, coupons admin, store settings page, stock history, sitemap / SEO, Shipping & Returns, Contact, Privacy and Terms pages. |

Not included, as stated in proposal §13: automatic payment gateway, courier
integration, advanced accounting. (A gateway-ready core exists for later; see
`PAYMENTS.md`.)

## 2. Documents

| File | For | Contents |
|---|---|---|
| [`ADMIN-GUIDE.md`](ADMIN-GUIDE.md) | Store owner & staff | Daily work: messages, payments, orders, products, stock, reports, settings — with a Roman Urdu summary |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Developer | Going live on Supabase + Vercel, first admin, backups, rollback, troubleshooting |
| [`QA-REPORT.md`](QA-REPORT.md) | Both | Test results, Lighthouse scores, security review, known limitations |
| [`PAYMENTS.md`](PAYMENTS.md) | Developer | How payments work; how a direct gateway could be added later |
| [`../README.md`](../README.md) | Developer | Code layout, commands, tests |

## 3. Quality at handover

- Automated tests: **127 unit, 93 database, 213 end-to-end** (desktop and
  phone) — all passing; also run by GitHub Actions on every pull request.
- `npm audit`: 0 vulnerabilities. Lighthouse desktop 99–100; mobile see QA report.
- Accessibility: automated WCAG A/AA checks on every key page.

## 4. To go live (owner's accounts — about 1–2 hours)

Follow [`DEPLOYMENT.md`](DEPLOYMENT.md). In short:

1. Create a **new Supabase project** (the old one has a different database) and
   run the migrations.
2. Set up Supabase **login emails** (SMTP + the two templates).
3. Put the 4 **environment variables** into Vercel.
4. **Merge pull request #1** → Vercel publishes the new site.
5. Run `supabase/setup/store-details.sql` (contact details and EasyPaisa /
   JazzCash 0308 2340478, Muhammad Waseem).
6. Create the owner's admin account; add categories, products and photos.
7. Run `npm run preflight -- --site https://your-domain` and the 15-minute
   smoke test.

## 5. Still needed from the client

- [ ] Real products, photos, prices and stock (17 sample products exist only on
      test databases).
- [ ] Approval of the Shipping & Returns, Privacy and Terms wording in
      `src/config/policies.ts` (pages show "Draft wording" until then).
- [ ] Domain name and access to its DNS; a Supabase (Pro recommended) and Vercel
      account; an email sending service (SMTP).

## 6. Known limitations

- Admins see new chats only while the admin site is open (no phone alerts yet).
- Rate limits are per server instance (enough for normal traffic).
- Two-factor login for admins is not enabled (can be added).
- Details: [`QA-REPORT.md`](QA-REPORT.md) §4.

## 7. Acceptance checklist (sign-off)

- [ ] Customer can browse, filter, search and open products on a phone
- [ ] Customer can order with COD; order number and confirmation shown
- [ ] Customer can order with EasyPaisa / JazzCash and upload a receipt
- [ ] Admin can approve / reject the payment; customer sees the result
- [ ] Admin can move an order to Delivered; customer sees it in tracking
- [ ] Admin can add a product with photos, sizes and stock
- [ ] Admin can adjust stock and see the history
- [ ] Admin can see daily / monthly reports and download the CSV
- [ ] Customer and admin can chat live
- [ ] Contact details, WhatsApp and wallet numbers are correct

Signed (client): ____________________  Date: ____________

---

## Roman Urdu khulasa

**Kya deliver hua:** proposal ke har point ke mutabiq poora online store:
- Shop, cart aur checkout
- COD, EasyPaisa aur JazzCash (receipt upload aur admin ki verification ke saath)
- Customer account aur order tracking
- Admin panel: orders, payments, products, tasveerein, stock, customers, coupons, reports aur settings
- Customer aur admin ke darmiyan **live chat**

**Documents:**
- `ADMIN-GUIDE.md`: store chalane ka tareeqa
- `DEPLOYMENT.md`: site live karne ka tareeqa
- `QA-REPORT.md`: testing ke nataij

**Live karne ke liye:**
1. Naya Supabase project banayein.
2. Vercel mein settings daalein.
3. PR #1 merge karein.
4. Store ki details wali SQL chalayein.
5. Owner ko admin banayein.
6. Products daalein.

Tafseel `DEPLOYMENT.md` mein hai.

**Client se abhi chahiye:**
- Asli products aur tasveerein
- Policies ke matan ki manzoori
- Domain, aur Supabase/Vercel ke accounts
