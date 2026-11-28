# Deployment guide — Vercel + Supabase

This guide puts the store live on **Vercel** (website) with **Supabase**
(database, login, file storage). Follow the steps in order; each ends with a
check. Allow about 1–2 hours the first time.

> **Never** paste keys or passwords into chat, email, screenshots or Git.
> They go only into the Vercel and Supabase dashboards (and, briefly, a local
> `.env.production.local` file for the pre-flight check, deleted afterwards).

Dashboard menu names change from time to time; if a label differs slightly,
look for the closest match.

---

## 0. Before you start

You need:

- [ ] Access to the GitHub repository `waseemakram16120-source/mohsin-futuretech`
- [ ] A **Vercel** account (free Hobby plan is fine to start; Pro for a business)
- [ ] A **Supabase** account — **Pro plan recommended** for a live shop (daily
      backups, no pausing). Free projects pause after a week without visits.
- [ ] The **domain name** (e.g. `mohsinfuturetech.pk`) and access to its DNS
- [ ] An **email sending service** for login/reset emails (Supabase's built-in
      email is for testing only and sends just a few emails per hour). Any SMTP
      provider works — e.g. Resend, Brevo, SendGrid, Zoho Mail — with a sender
      address on your domain such as `no-reply@your-domain`.
- [ ] From the client: EasyPaisa / JazzCash account name + number, WhatsApp
      number, phone, email, shop address, delivery charge, products & photos.

### The old live site

The site live today (old code, Supabase project `mohsin-futuretech` from
25 Nov) uses a **different, older database design**. The new version must be
installed on a **new, empty Supabase project**. Keep the old project untouched
until the new site is live and checked, then pause or delete it.

If the old project holds **real** customer orders, export them first
(Table Editor → `orders` → Export → CSV) — moving old orders into the new
design is not part of this release.

---

## 1. Create the Supabase project

1. supabase.com → **New project**. Name: `mohsin-futuretech-prod`.
   Region: **Southeast Asia (Singapore)** (closest to Pakistan). Choose a
   strong database password and store it in a password manager.
2. When it is ready, open **Project Settings → API** (or *Data API* /
   *API Keys*) and note — privately — these three values:
   - Project URL → `https://<ref>.supabase.co`
   - `anon` / publishable key (public, safe in the browser)
   - `service_role` / secret key (**secret** — full access, server only)

**Check:** the project dashboard opens and shows "Healthy".

## 2. Create the database (migrations)

The whole database — tables, security rules (RLS), functions and the two
storage buckets — is in `supabase/migrations/`, 11 files applied in name order.

**Option A — Supabase CLI (recommended).** On a computer with Node.js 20+ and
the repository cloned:

```bash
npm ci
```

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npx supabase db push --dry-run
```

The dry run must list all 11 migrations, from `20261126000001_schema.sql` to
`20261129000011_admin_reports.sql`. Then apply them:

```bash
npx supabase db push
```

`db push` does **not** load the sample products (`supabase/seed.sql`) — that
is intended for production.

**Option B — SQL editor.** Dashboard → **SQL Editor** → for each file in
`supabase/migrations/`, oldest first, paste the whole file and **Run**. Do not
skip or reorder files. Do not run `seed.sql` on production.

**Check:** Table Editor shows tables such as `products`, `orders`,
`payments`, `store_settings`; Storage shows buckets **product-images**
(public) and **payment-receipts** (private).

> Sample data for a *staging* project only: `npx supabase db push --include-seed`
> loads 17 sample products and the `WELCOME10` coupon.

## 3. Configure Supabase Auth (login & emails)

Dashboard → **Authentication**:

1. **URL Configuration**
   - Site URL: `https://your-domain` (no trailing slash)
   - Redirect URLs: add `https://your-domain/**`
     (and `https://www.your-domain/**` if you use `www`).
2. **Sign In / Providers → Email**
   - Enable Email provider: **on**
   - **Confirm email: on** (new customers confirm their address)
   - Secure email change: on
   - Minimum password length: **8** (the site also requires a letter and a number)
   - Leaked password protection: on (if your plan offers it)
3. **Emails → SMTP Settings**: enable custom SMTP and enter your email
   provider's host, port, username, password and sender
   (`no-reply@your-domain`, sender name `Mohsin FutureTech`).
4. **Emails → Templates** — replace two templates so links open on your site
   (they work on any device):
   - **Confirm signup**: subject `Confirm your Mohsin FutureTech account`,
     body = contents of `supabase/templates/confirmation.html`
   - **Reset password**: subject `Reset your Mohsin FutureTech password`,
     body = contents of `supabase/templates/recovery.html`
5. **Rate Limits**: keep the defaults.

**Check:** later (step 7) a password-reset email arrives and its link opens
`https://your-domain/auth/confirm…` and then the "Choose a new password" page.

## 4. Deploy on Vercel

1. vercel.com → **Add New… → Project** → import the GitHub repository.
   Framework: **Next.js** (auto-detected). Build and output settings: leave
   the defaults. Node.js version (Settings → Build): **22.x**.
2. **Environment Variables** (Settings → Environment Variables), for the
   **Production** environment:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key (mark **Sensitive**) |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain` (no trailing slash) |

   Leave every `PAYMENTS_*`, `JAZZCASH_*` and `EASYPAISA_*` variable **unset**:
   EasyPaisa and JazzCash then run in the proposal's manual mode (customer
   uploads Transaction ID + receipt, admin approves). Never set
   `PAYMENTS_TEST_GATEWAY` on Vercel.

   For **Preview** deployments, use a separate *staging* Supabase project —
   never the production keys.
3. **Production branch.** The new code is on branch
   `claude/compassionate-archimedes-ftdeig`. Merge it into `main` through a
   pull request (after review), so `main` deploys to production.
4. **Domains** (Settings → Domains): add `your-domain` and `www.your-domain`,
   then create the DNS records Vercel shows at your domain registrar. HTTPS is
   automatic.
5. After changing any `NEXT_PUBLIC_*` variable, **Redeploy** (these values are
   built into the site).

**Check:** `https://your-domain/api/health` returns `{"status":"ok",…}` and the
home page loads.

## 5. Create the first admin

1. On the live site, **Create account** with the owner's email and confirm it
   from the email.
2. Supabase → **SQL Editor**, run (replace the email):

   ```sql
   update public.profiles set role = 'admin' where email = 'owner@example.com';
   ```
3. Sign out and in again, then open `https://your-domain/admin`.

To add staff, repeat with their email. To remove admin rights:
`update public.profiles set role = 'customer' where email = '…';`
Give admin only to people who handle orders and payments.

**Check:** `/admin` shows the Dashboard; a non-admin account sees "Access denied".

## 6. Set up the shop (Admin)

See `docs/ADMIN-GUIDE.md`. In short:

1. **Settings**: store name, WhatsApp, phone, email, address, delivery charge,
   free-delivery amount, low-stock level, **EasyPaisa and JazzCash account
   name + number** (double-check them — customers pay exactly what is shown).
2. **Categories** → photos for each.
3. **Products** → add products, photos, sizes/colours and opening stock.
4. **Coupons** (optional), e.g. a welcome code.
5. Policies: the developer updates `src/config/policies.ts` with the
   owner-approved wording, sets `draft: false` and redeploys.

## 7. Pre-flight check

On the developer's computer, create `.env.production.local` (git-ignored) with
the four production variables from step 4, then run:

```bash
node --env-file=.env.production.local scripts/preflight.mjs --site https://your-domain
```

It checks (read-only): variables, https, keys, every migration and function,
private receipts bucket, admin account, sample products, wallet accounts,
placeholder contacts, email confirmation, the live site's health, security
headers and sitemap. Fix every **✗**; review every **!**. Delete
`.env.production.local` afterwards.

## 8. Launch smoke test (15 minutes, on a phone)

- [ ] Home, a collection, a product page and search load with real photos
- [ ] Sign up → confirmation email arrives → link signs you in
- [ ] Forgot password → email arrives → new password works
- [ ] Place a **COD** order → order page shows the number and "Pending"
- [ ] Place an **EasyPaisa** order → account details shown → send a small real
      payment → upload Transaction ID + screenshot → "Pending Verification"
- [ ] Admin → Payments → receipt visible → **Approve** → order "Confirmed"
- [ ] Admin → order → Processing → Shipped (note courier tracking) → Delivered
- [ ] Customer: My Account → Orders shows "Delivered"; `/track` finds the order
- [ ] COD order: Delivered → Payments → **Mark as paid**
- [ ] Admin → Reports shows the test orders; **Download CSV** opens in Excel
- [ ] Cancel the test orders (stock returns) or leave them, as the owner prefers

## 9. Backups & recovery

**Database**
- **Pro plan:** Supabase keeps daily backups (restore from Database →
  Backups). Point-in-time recovery is an optional add-on.
- **Any plan — weekly manual backup** (keep copies off the computer, e.g. a
  private cloud drive):

  ```bash
  npx supabase db dump --linked -f backup-schema-$(date +%F).sql
  ```

  ```bash
  npx supabase db dump --linked --data-only -f backup-data-$(date +%F).sql
  ```
- Before applying any **new migration**, take a backup first. Migrations only
  move forward; there is no automatic "undo".

**Files (product photos, payment receipts)** are in Storage, not in the
database dump. Download them from Storage in the dashboard, or with the CLI's
experimental copy command:

```bash
npx supabase storage cp -r ss:///product-images ./backup-product-images --experimental --linked
```

```bash
npx supabase storage cp -r ss:///payment-receipts ./backup-payment-receipts --experimental --linked
```

Payment receipts contain customers' personal data: store those copies
privately and delete old ones when no longer needed.

**Recovery**
- Website broken after a deploy → Vercel → Deployments → previous good
  deployment → **Instant Rollback** (seconds; the database is unaffected).
- Data deleted by mistake → restore the latest backup into a **new** Supabase
  project, check it, then point the Vercel variables at it (or copy the
  missing rows back).
- A key leaked → Supabase → API keys → **roll** the service_role key → update
  it in Vercel → redeploy. Existing customer sessions continue.

## 10. Updating the site later

1. Work on a branch; GitHub Actions (`.github/workflows/ci.yml`) runs lint,
   type checks, unit, database and end-to-end tests on every push.
2. Vercel builds a **Preview** for each branch (point Preview variables at a
   staging Supabase project).
3. New database changes = new file in `supabase/migrations/`; back up, then
   `npx supabase db push`, then merge to `main`.
4. Run the pre-flight check after each release.

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| EasyPaisa / JazzCash missing at checkout | Fill both account name **and** number in Admin → Settings (placeholders are ignored on purpose). |
| Login/confirmation emails don't arrive | Custom SMTP not set or sender domain not verified with the email provider (step 3). Check Supabase → Logs → Auth. |
| Email link opens a "link invalid or expired" page | Templates not replaced, or Site URL / Redirect URLs wrong (step 3). Links work once. |
| Uploaded photos don't show | `NEXT_PUBLIC_SUPABASE_URL` changed after the build → redeploy. |
| Admin sees "Access denied" | Their profile role is not `admin` (step 5); sign out and in again after changing it. |
| Pages show old prices/stock for a minute | Normal: catalogue pages cache for up to 60 s; admin changes refresh immediately; bag and checkout always re-check live prices and stock. |
| Site down / 500 errors | Vercel → Deployments → logs; roll back if a deploy caused it; check `/api/health` and the Supabase status page. |
