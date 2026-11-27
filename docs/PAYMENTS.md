# Payments — COD, JazzCash, Easypaisa

Implemented against `STRICT_JazzCash_Easypaisa_Payment_Integration.md` (on `main`).

| Method | Status |
|---|---|
| Cash on Delivery | **Live-ready.** Admin marks it Paid after delivery. |
| Easypaisa / JazzCash — **manual** (default) | **Live-ready (customer side).** Proposal §4: customer pays the store's account, submits Transaction ID + receipt screenshot, payment shows **Pending Verification** until an admin approves or rejects it. Offered only when the account name and number are set in `store_settings`. Admin review screen: Phase 7. |
| Easypaisa / JazzCash — direct merchant gateway | **Core built and tested; provider adapters BLOCKED** — official merchant integration guide + sandbox credentials not yet available. Switched on per wallet with `PAYMENTS_GATEWAY_METHODS` once an adapter is complete. |
| NayaPay | **Retired.** Old orders stay readable; new ones are refused by the database. |

### Manual wallet flow (migration `0007_manual_wallet_payments`)

```
Checkout (Easypaisa/JazzCash, manual) ──► place_order()   payment: awaiting_payment
Order page shows store account, exact amount, order number, steps
Customer ──POST /api/payments/evidence (multipart)──►
   ├─ same-origin + rate limit + strict field list
   ├─ authorise: browser that placed it (signed cookie) or signed-in owner
   ├─ Transaction ID: 6–40 letters/digits/dashes; note ≤ 500 chars (Zod)
   ├─ receipt ≤ 5 MB, type from the file's BYTES (JPG/PNG/WebP only)
   ├─ upload to PRIVATE bucket payment-receipts/<order_id>/receipt-….ext
   └─ submit_payment_evidence()  → pending_verification (file deleted if refused)
Admin ── review_payment(approve | reject + reason | mark_paid)
```

- A Transaction ID can back only one live submission (unique index).
- One submission at a time; after a rejection the customer can resubmit
  (new record, the rejected one stays as history).
- Manual and gateway never overlap on one order: evidence is refused while a
  gateway charge is pending, and a gateway charge cannot start while evidence
  is under review.
- Nothing a customer submits can make a payment approved or paid.

Production readiness: manual wallets ready (customer side); direct gateway **NOT READY** for JazzCash/Easypaisa (see "Blockers").

---

## 1. How it works

```
Checkout ──POST /api/orders──► place_order()            order: pending, payment: awaiting_payment
   │                                                     stock reserved, prices from DB
   └─POST /api/payments/initiate {orderNumber}
        ├─ authorise: browser that placed it (signed cookie) or signed-in owner
        ├─ start_payment_attempt()  amount = order total in paisa, PKR
        │     re-uses an open attempt (double click = same attempt)
        │     refuses while an attempt is pending at the provider
        ├─ provider.initiate()      ► hosted payment page (no PIN/OTP on our site)
        └─ attempt: created → pending
Provider ──callback/return──► /api/payments/callback/{provider}
        ├─ provider.verifyCallback()   signature/hash per OFFICIAL docs
        ├─ apply_payment_event()       one DB transaction, row locks:
        │     dedupe key UNIQUE (replay), known reference, amount + currency
        │     match, provider txn id unique, allowed transition only
        └─ 303 → /orders/{number}?payment=return   (status read from DB)
```

The browser can never mark a payment paid: return URLs, query parameters,
screenshots and client state are ignored for payment truth.

### Payment attempt state machine

`created → pending → processing → paid | failed | cancelled | expired`

- `paid` is terminal: a late `failed`/`cancelled` callback is **ignored**.
- `failed/cancelled/expired → paid` is allowed only for a provider-verified
  success (money was taken); if the order was already paid or cancelled the
  attempt is flagged `needs_review` (refund decision).
- Defined once in SQL (`payment_attempt_can_transition`) and mirrored in
  `src/lib/payments/status.ts`; a test asserts they match.
- Order fulfilment status is separate. A verified payment moves a
  `pending` order to `confirmed` only.

### Database (migration `0006_payment_gateway`)

- `payment_attempts`: opaque 20-char `reference` (unique), order, provider,
  `amount_minor` (paisa, bigint), `currency` = PKR, status, `provider_txn_id`
  (**unique per provider**), safe failure code/message, `needs_review`,
  expiry/initiated/verified timestamps. **One open attempt per order** (partial unique index).
- `payment_events`: every initiation/callback/status check with a **unique
  `dedupe_key`** (durable replay protection), outcome
  (`applied/duplicate/ignored/rejected`), reason, redacted details.
- Functions (service role only): `start_payment_attempt`, `apply_payment_event`,
  `payment_attempts_to_reconcile`, `order_payment_state`.
- RLS forced; admins may read the ledger; nobody writes directly.
- No backfill needed: only new objects. `submit_payment_evidence` execute is
  revoked (manual receipts retired); a trigger refuses new NayaPay orders.

---

## 2. Connecting your merchant accounts (owner steps)

1. **Apply for merchant accounts** (business documents, bank account):
   - JazzCash: JazzCash Business / Online Payment Gateway merchant onboarding.
   - Easypaisa: Easypaisa / Easypay online merchant onboarding.
2. When approved, each provider gives you (through their merchant portal):
   - the **integration guide / API document** for the product you were approved for
     (e.g. hosted checkout / page redirection, mobile account, status inquiry),
   - **sandbox credentials** and later **production credentials**.
3. Send the developer **the integration guide PDFs** (put them in
   `docs/payments/` — they are not secret) and keep credentials private.
4. In each merchant portal register these URLs (production domain must be https):
   - JazzCash return/callback: `https://YOUR-DOMAIN/api/payments/callback/jazzcash`
   - Easypaisa post-back/callback: `https://YOUR-DOMAIN/api/payments/callback/easypaisa`
5. Put credentials **only** in the hosting provider's environment variables
   (Vercel → Project → Settings → Environment Variables) — never in Git, chat or email.

## 3. Environment variables (server only)

See `.env.example`. Never prefix these with `NEXT_PUBLIC_`.

| Variable | Purpose |
|---|---|
| `PAYMENTS_ENV` | `sandbox` (default) or `production` |
| `PAYMENTS_LIVE_ENABLED` | must be `true` for production payments (owner approval switch) |
| `PAYMENTS_PUBLIC_BASE_URL` | site URL used in callbacks; **https** required in production |
| `JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT`, `JAZZCASH_API_BASE_URL` | reserved names; final mapping confirmed from the official guide |
| `EASYPAISA_STORE_ID`, `EASYPAISA_HASH_KEY`, `EASYPAISA_API_BASE_URL` | reserved names; final mapping confirmed from the official guide |
| `PAYMENTS_RECONCILE_SECRET` | ≥ 32 random chars; bearer token for `POST /api/payments/reconcile` |
| `PAYMENTS_TEST_GATEWAY` | `1` enables the internal **sandbox test gateway** (refused in production) |

A provider with missing credentials, or whose adapter is not implemented, is
**disabled and hidden** at checkout — never faked.

## 4. Sandbox testing

Local stack: `npm run db:start`, then `npm run test`, `npm run test:db`, `npm run test:e2e`.

E2E runs with `PAYMENTS_TEST_GATEWAY=1`: JazzCash/Easypaisa orders go to
`/payments/test-gateway`, an **internal page clearly labelled "not JazzCash or
Easypaisa, no real money"** that posts HMAC-signed callbacks. It exercises the
real pipeline (initiation, verification, idempotency, transitions). It is not
evidence that the real provider integrations work.

## 5. Reconciliation (uncertain payments)

A timeout does not mean failure. `POST /api/payments/reconcile`
(`Authorization: Bearer $PAYMENTS_RECONCILE_SECRET`, e.g. Vercel Cron every 10 min):
- expires attempts never sent to a provider;
- lists `pending/processing` attempts past expiry for a provider status
  inquiry. **The status-inquiry call is not implemented** (needs the official
  docs); until then these are logged for manual follow-up and are never
  assumed failed. While an attempt is pending the customer cannot start a
  second payment for that order.

## 6. Refunds

Not implemented (no confirmed refund API/permissions). Attempts flagged
`needs_review` (double charge, paid after cancellation) must be refunded
manually from the merchant portal and noted on the order.

## 7. Remaining work to go live (blockers)

1. **Official integration guides** for the exact JazzCash and Easypaisa products
   approved for this store (endpoints, request fields, secure-hash/signature
   algorithm and field ordering, response codes, status-inquiry API, version).
   Their public sites rejected automated access and the sandbox portal requires login.
2. **Sandbox credentials** for both providers.
3. Implement `initiate`, `verifyCallback` and status inquiry in
   `src/lib/payments/providers/` from those guides; add sandbox tests for
   success, failure, cancel, pending, invalid hash, wrong merchant/amount/currency, replay.
4. Production: https domain, callback URLs registered, production credentials
   in Vercel, `PAYMENTS_ENV=production`, then owner approval to set
   `PAYMENTS_LIVE_ENABLED=true`.

## 8. Production readiness checklist (spec §19)

| Item | Status |
|---|---|
| Official docs obtained, API versions confirmed | ❌ blocked |
| Merchant accounts + production credentials | ❌ owner action |
| Sandbox/production config separated | ✅ |
| HTTPS enforced in production config | ✅ (config refuses http) — hosting not yet set up |
| Secrets server-side, not in Git, not in bundle | ✅ (bundle scan test) |
| Server-side initiation, server-computed amount/currency | ✅ |
| Order ownership verified (no IDOR) | ✅ |
| Callback authenticity verification | ✅ test gateway; ❌ JazzCash/Easypaisa (fail closed) |
| Provider status verification | ❌ blocked on docs |
| Amount/currency/merchant/reference/txn matching | ✅ amount, currency, reference, txn; merchant id ❌ (provider-specific) |
| Duplicate callbacks idempotent, replay protection | ✅ |
| Race conditions tested | ✅ (concurrent callbacks DB test) |
| DB constraints/migrations | ✅ |
| Status transitions enforced | ✅ |
| Customer cannot mark paid | ✅ |
| Logs redacted | ✅ |
| Rate limits + authorisation | ✅ (in-memory per instance) |
| Sandbox scenarios on real providers | ❌ blocked |
| No test path in production | ✅ test gateway refused when `PAYMENTS_ENV`/`VERCEL_ENV` = production |
