# Final QA report — Phase 9

Date: 28 November 2026 · Branch: `claude/compassionate-archimedes-ftdeig`
Environment: production build (`next build` + `next start`) against the local
Supabase stack (`npm run db:start`). Numbers on the live Vercel site will differ
somewhat (network, CDN, real photos).

## 1. Automated tests — all passing

| Suite | Command | Result |
|---|---|---|
| Unit (Vitest) | `npm test` | **123 passed** |
| Database / RLS (Vitest + Postgres) | `npm run test:db` | **88 passed** |
| End-to-end (Playwright, desktop 1440×900 + Pixel 7) | `npm run test:e2e` | **205 passed**, 9 skipped (device-specific) |
| Lint / types | `npm run lint`, `npm run typecheck` | clean |
| Dependencies | `npm audit` | **0 vulnerabilities** |

The end-to-end suite covers the whole proposal workflow (§8, steps 1–10) in
`tests/e2e/golden-path-checkout.spec.ts`: sign-up → browse → size → bag →
checkout → Easypaisa receipt → admin approve → processing → shipped →
delivered → customer sees it in My Account — on desktop and on a phone.

## 2. Lighthouse (production build, local)

Mobile = Lighthouse default (simulated slow 4G, 4× slower CPU). Scores are
Performance / Accessibility / Best practices / SEO.

| Page | Mobile | Desktop | Mobile LCP |
|---|---|---|---|
| Home | 93 / 96→100* / 100 / 100 | 100 / 100* / 100 / 100 | 2.5–3.2 s |
| Collection (Men) | 81–99 / 100 / 100 / 100 | 99 / 100 / 100 / 100 | 2.0–4.8 s (varies run to run) |
| Product | 91 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 3.3 s |
| Checkout | 78–82 / 100 / 100 / 63† | 100 / 100 / 100 / 63† | 4.4–4.9 s |
| Login | 96–97 / 100 / 100 / 63† | 100 / 100 / 100 / 63† | 2.5 s |

\* The home-page accessibility issue (a photo link without a name) was fixed
after the measurement and is covered by an automated check.
† SEO 63 is intended: checkout and login are marked `noindex` (they must not
appear in Google). CLS is ≤ 0.09 everywhere (good is < 0.1).

Checkout is the slowest page on a throttled phone because the bag lives in the
browser (it is read after the page loads). It is fully usable; a future
improvement would be to render a server-side summary of the bag.

### Fixed during this phase
- **Fonts** — the italic display font (45 KB) was preloaded on every page
  although only one hero word uses it. It now loads after the page renders
  (not preloaded), so only two fonts compete with the first paint. Mobile LCP
  on the product page improved from 4.7 s to 3.3 s; home 92 → 84–97 (run to run),
  collection 92 → up to 99.
- **Content-Security-Policy violation** — Zod probed for `eval`; all imports now
  go through `src/lib/z.ts` in jitless mode. Best practices 96 → 100.
- **Screen readers heard every product name twice** (photo alt + heading) —
  card and hero photos are decorative; the name stays on the link/heading.
- **Heading order** — listing/wishlist cards and empty states use h2.

## 3. Responsive & links

- `tests/e2e/qa.spec.ts` opens 19 public pages at **360, 390, 768, 1024 and 1440 px**
  and fails if any page scrolls sideways or logs a console error. Account and
  admin pages are checked on phone and desktop in the golden-path test.
- **Fixed:** the size-guide tables made the page scroll sideways on 360–390 px
  phones; the table now scrolls inside its own (keyboard-focusable) box.
- The link crawler follows every internal link two levels deep from the home
  page (40+ pages): **no broken links**.
- **Fixed:** footer links to Shipping & returns, Contact, Privacy and Terms
  returned 404 — the pages now exist (wording in `src/config/policies.ts`,
  marked *draft* until the owner confirms it; amounts and contacts come from
  Admin → Settings).
- `sitemap.xml` (all products, categories, info pages) and `robots.txt`
  (admin, account, checkout, cart, orders, APIs excluded) added.

## 4. Security review

| Area | Status |
|---|---|
| Secrets | Only in environment variables; service-role key used in server-only modules; a test scans the browser bundle for secret names/values. `.env*` ignored by git. |
| Database access (RLS) | **RLS enabled and forced on all 17 tables.** Customers read only their own profile, addresses, wishlist, orders and payments; they cannot insert or change orders/payments (server functions only). Covered by 88 DB tests. |
| Database functions | Every `security definer` function has a fixed `search_path`; admin functions call `require_admin()`; customers calling them directly get 403 (tested). |
| Admin area | Role check on every page and Server Action, plus `require_admin()` in the database. Signed-out → sign in; customers → Access denied (tested). |
| Input validation | Zod on every form and API on the server; the database re-checks constraints. |
| Uploads | Receipts and product photos: JPG/PNG/WebP decided from the file's bytes (not its name), 5 MB limit, enforced again by Storage bucket rules. Receipts in a **private** bucket, admins see them through 1-hour signed links. |
| Payments | Customers can never mark anything approved/paid; manual evidence only moves to *Pending Verification*. Duplicate Transaction IDs refused. |
| Auth | Supabase Auth; open-redirect protection on every `next=` parameter; same message for wrong email/password; reset links single-use. Per-IP rate limits on sign-in/up, password reset, order tracking, orders and payment uploads. |
| HTTP headers | Content-Security-Policy (no framing, no plugins, no foreign forms/base, network only to this site + Supabase), `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, permissions policy, HSTS on https. `X-Powered-By` removed. Tested. |
| XSS | React escapes output; the one raw HTML use (product JSON-LD) escapes `<`. |
| CSV export | Spreadsheet formulas neutralised (CSV-injection safe). |
| Dependencies | `npm audit`: 0 vulnerabilities. |

### Live chat (added after Phase 10)
Customers chat with the store from a button on every page; admins answer in
Admin → Messages. Guests are tied to their chat by a random token kept in an
httpOnly cookie (only its SHA-256 is stored); signed-in customers by their
account. RLS (forced) lets customers read only their own chat; all writes go
through server-checked database functions; admin functions require the admin
role; messages are plain text (1–1000 characters, control characters
stripped) and rate-limited. Updates arrive by polling (4 s while the chat is
open, 30 s for the unread badge) rather than Supabase Realtime, because
Realtime's RLS cannot cover guests without an account. Tests: 4 unit, 5
database, 8 end-to-end (desktop + mobile).

### Known limitations / recommendations (not blocking launch)
1. **Rate limits are per server instance** (in memory). On Vercel they still stop
   simple abuse; for heavy traffic move them to a shared store (e.g. Upstash).
2. **CSP allows inline scripts** — required by Next.js without per-request nonces;
   nonces would make every page dynamic and slower. Everything else is locked down.
3. **Hosted Supabase settings to apply at deployment** (Phase 10 guide): email
   confirmation on, custom SMTP, minimum password length 8, leaked-password
   protection, redirect URLs, the email templates in `supabase/templates/`.
4. **Admin two-factor login** is not enabled; Supabase MFA can be added later.
5. **Backups** depend on the Supabase plan (daily backups on Pro; point-in-time
   recovery is an add-on) — see Phase 10.
6. **Chat notifications**: admins see new chats only while the admin site is
   open (no email/WhatsApp/push alert yet). A guest who clears cookies or
   changes device cannot reopen their old chat (they start a new one).

## 5. Comparison with the reference stores

Screenshots of the reference sites were not provided (`docs/references/` is
empty) and the sites could not be opened from this environment, so this
comparison is against **typical patterns of Pakistani fashion stores such as
those references**, not a live side-by-side check.

| Area | Typical reference-store pattern | This store |
|---|---|---|
| Navigation | Mega menu, announcement bar | Sticky header, announcement bar with live free-delivery amount, accessible mobile menu, search on every page |
| Listing | Grid + sort; filters often limited | Filters for category, price, size, colour, in stock, on sale; sort; shareable URLs; filter drawer on phones |
| Product page | Gallery, sizes, WhatsApp | Gallery, colour/size with live stock per variant, size guide, delivery promise, WhatsApp question link, structured data for Google |
| Checkout | COD + sometimes wallets | Guest or account checkout, saved addresses, coupon, COD + EasyPaisa + JazzCash with receipt upload and status page |
| After purchase | WhatsApp follow-up | Order page with progress timeline, tracking by order number + phone, order history in My Account |
| Admin | Shopify/WooCommerce back office | Purpose-built: payment verification queue, order workflow with audit history, stock history, reports with CSV |
| Accessibility & speed | Varies; often heavy themes | WCAG A/AA automated checks on every key page; desktop Lighthouse 99–100 |

## 6. Still needed from the client before launch
- Real products, photos, prices and stock (replace the 17 samples).
- ~~EasyPaisa / JazzCash accounts, WhatsApp, phone, email, shop address~~ —
  received (owner Muhammad Waseem); applied by `supabase/setup/store-details.sql`
  at deployment. Confirm both wallets are registered in that name.
- Confirm the shipping/returns/privacy/terms wording in `src/config/policies.ts`,
  then set `draft: false`.
- The production Supabase project and Vercel account (Phase 10).
