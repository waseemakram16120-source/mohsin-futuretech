# STRICT PAYMENT INTEGRATION SPECIFICATION
## Direct JazzCash + Easypaisa Integration for E-Commerce

> **Priority:** CRITICAL / SECURITY-SENSITIVE  
> **Instruction to AI Agent:** Treat this document as mandatory. Payments involve financial transactions. Do not take shortcuts, weaken validation, expose credentials, or report completion without evidence from implementation and testing.

---

## 1. Objective

Implement direct merchant payment integrations for:

- **JazzCash**
- **Easypaisa**

Integrate these payment providers into the existing e-commerce website. Customers must be able to choose either provider during checkout, complete payment using the provider's approved flow, and have their order/payment status updated only after secure server-side verification.

This is a direct merchant integration—not a third-party aggregator integration.

## 2. Non-Negotiable Rules

1. **Inspect the existing project before changing anything.**
   - Identify frontend, backend, database, authentication, order/cart models, API conventions, environment configuration, deployment setup, and existing payment code.
   - Read relevant project documentation and existing tests.
   - Do not replace, restructure, or rewrite the existing architecture without a compelling technical reason and explicit explanation.

2. **Use official provider documentation and merchant onboarding specifications only.**
   - Obtain current JazzCash and Easypaisa API documentation.
   - Confirm the merchant account/product/API version actually approved for this project.
   - Do not guess endpoints, payloads, signature algorithms, field names, callback rules, encryption requirements, or payment statuses.
   - If credentials, merchant access, or documentation are missing, build only the verified integration scaffolding and clearly identify the blocked items. Never invent a successful integration.

3. **Never trust the frontend for payment truth.**
   - A success page, URL parameter, browser response, client-side state, screenshot, uploaded receipt, or customer claim must NEVER cause an order to be marked `paid`.
   - Only a verified provider response/callback/webhook or an authenticated server-to-server status verification—according to the provider's official protocol—may confirm payment.

4. **Secrets must never be exposed.**
   - Merchant secrets, passwords, signing salts, API keys, encryption keys, and private tokens must remain on the server.
   - Never place secrets in frontend source, browser bundles, HTML, mobile code, logs, git, public configuration, or API responses.
   - Use environment variables and server-side configuration. Do not hardcode credentials.

5. **Fail securely.**
   - Invalid, missing, mismatched, expired, duplicate, or unverifiable payment messages must not mark an order as paid.
   - If provider verification is unavailable, leave the payment pending or in an appropriate non-paid state. Never assume success.

6. **Do not remove or weaken existing security, validation, authentication, authorization, rate limiting, or tests to make integration work.**

7. **Do not use unofficial SDKs or copied payment code blindly.** Review dependencies, versions, maintenance, license, vulnerabilities, and source. Prefer official SDKs when available or a minimal implementation based on official docs.

---

## 3. Mandatory Initial Assessment

Before implementation, provide an internal implementation plan and inspect:

- Frontend framework and checkout flow
- Backend framework, API routes, middleware, and services
- Database schema and migrations
- Existing orders, cart, users, inventory, shipping, and order status logic
- Authentication and customer session handling
- Existing payment-related code or packages
- Current environment variables and secret management
- Test framework and CI checks
- Hosting, HTTPS, callback URL, and deployment configuration

Then implement the integration consistent with the existing project.

Do not create duplicate order, payment, or checkout systems if existing ones can be safely extended.

---

## 4. Payment Checkout Requirements

At checkout, provide clearly labeled payment methods:

- JazzCash
- Easypaisa

Follow existing design conventions and keep the interface responsive, accessible, and consistent.

The frontend must:

- Allow the customer to choose a payment provider.
- Show the order amount and currency clearly.
- Prevent accidental multiple submissions while an initiation request is in progress.
- Display safe, understandable messages for pending, cancelled, failed, and successful states.
- Never display a payment as successful merely because the customer returned to the website.
- Avoid exposing internal provider error details or secrets.
- Avoid storing sensitive wallet credentials, PINs, OTPs, or card data.

If the provider requires a hosted payment page, use its official hosted flow. Do not collect wallet PINs, OTPs, or sensitive payment credentials on our own website.

---

## 5. Backend Architecture Requirements

Use the project's existing architecture. Where appropriate, keep payment integration separated into clear responsibilities:

- Payment initiation/controller endpoint
- Provider-specific service or adapter for JazzCash
- Provider-specific service or adapter for Easypaisa
- Provider signature/hash/encryption utilities
- Payment callback/return handlers
- Provider status-verification service
- Payment persistence and status-transition service
- Idempotency/replay handling
- Logging and audit records

Keep provider-specific logic isolated. Avoid mixing JazzCash and Easypaisa signing or callback rules.

All payment initiation and verification must be performed server-side.

---

## 6. Order and Payment Integrity

### 6.1 Amount and currency

- Calculate the payable amount from trusted server-side order/cart data.
- Never accept the payment amount as authoritative from the browser.
- Validate currency against the provider's supported and merchant-approved currency (expected project currency: PKR, unless merchant setup says otherwise).
- Use integer minor units (e.g., paisa) or a safe decimal representation. Do not use floating-point arithmetic for money.
- Verify the amount and currency reported by the provider match the expected order payment exactly.
- Reject mismatched, underpaid, overpaid, or wrong-currency transactions unless a documented business rule explicitly handles the case safely.

### 6.2 Order association

Every payment attempt must be linked to:

- A valid internal order ID
- A unique payment attempt ID
- The selected provider
- Expected amount and currency
- Customer/order ownership where applicable

Do not expose sequential internal identifiers unnecessarily. Use opaque or securely generated identifiers for externally visible references.

### 6.3 Status model

Use the project's existing model if suitable. Otherwise implement a clearly defined state model, such as:

- `created`
- `pending`
- `processing`
- `paid`
- `failed`
- `cancelled`
- `expired`
- `refunded` (only if refunds are implemented and verified)

Do not allow arbitrary status changes.

Only verified transitions may occur. For example, a terminal `paid` status must not be downgraded to `failed` by a late or duplicated callback. Define and enforce transitions centrally.

Payment status and order fulfilment status should remain separate where the project architecture supports it. A payment being paid does not automatically mean an order is shipped or delivered.

---

## 7. Secure Payment Initiation

When the customer chooses JazzCash or Easypaisa:

1. Authenticate/validate the checkout request as appropriate.
2. Verify the customer is authorized to pay for the referenced order.
3. Confirm the order exists and is payable.
4. Recalculate/validate amount and currency on the server.
5. Ensure the order is not already paid, cancelled, or otherwise non-payable.
6. Create a unique payment attempt with a secure transaction/reference ID.
7. Use the provider's official API, merchant credentials, required signing, and required encryption.
8. Validate the provider's initiation response server-side.
9. Persist only the necessary response data—never store credentials or sensitive payloads unnecessarily.
10. Return only the safe information the frontend needs to continue the official checkout flow.

Use appropriate timeouts. Do not retry payment-creation calls blindly: retries can create multiple financial transactions. If retrying is supported, use the provider's documented idempotency/reference mechanism and reconcile the attempt first.

---

## 8. Callback, Return URL, and Webhook Security

Treat all incoming callback/return/webhook requests as untrusted until verified.

### Mandatory validation

- Verify provider signatures, MACs, hashes, authentication tokens, or encrypted payloads exactly according to current official documentation.
- Use constant-time comparison for cryptographic signature/hash comparisons where applicable.
- Validate merchant ID, transaction/reference ID, provider transaction ID, order/payment attempt association, amount, currency, status, and relevant timestamps.
- Verify that the callback belongs to a known payment attempt.
- Confirm payment using the provider's documented verification/status API when required or available as part of the protocol.
- Do not use a success query parameter or frontend callback alone as proof of payment.
- Do not trust status text without cryptographic and protocol validation.
- Reject invalid or malformed payloads safely.
- Enforce replay protection and idempotent processing.
- Do not leak sensitive validation details to the caller.

### Callback behavior

- Callback processing must be idempotent.
- Repeated callbacks must not create duplicate payments, duplicate order updates, repeated inventory deductions, or repeated fulfilment actions.
- Use database transactions and locking/atomic updates where needed to avoid concurrent race conditions.
- Return the provider-required response format only after processing safely. Follow provider retry expectations and avoid acknowledging unprocessed events in a way that loses them.
- Keep customer browser return handling separate from authoritative payment processing wherever the provider protocol permits.

If a provider's protocol is not webhook-based, implement the documented secure server-side confirmation/return flow instead. Do not invent webhook functionality.

---

## 9. Idempotency, Duplicate Transactions, and Replay Protection

Implement robust duplicate protection:

- Unique constraint for internal payment attempt/reference ID.
- Unique constraint for provider transaction ID where applicable.
- Idempotency key or equivalent unique request reference.
- Duplicate callback/event detection.
- Replay detection using documented provider identifiers, timestamps, signatures, or event IDs.
- Atomic state transitions.
- Concurrency-safe processing.

A repeated event for an already processed payment must return a safe result without re-applying side effects.

Do not rely solely on an in-memory set/cache for critical duplicate protection. Use durable storage, with database constraints as the final guard.

---

## 10. Database Requirements

Inspect the current schema and extend it minimally.

The system must be able to persist, at minimum, as appropriate to the existing project:

- Payment attempt ID
- Order ID
- Provider name
- Expected amount and currency
- Payment status
- Provider transaction/reference ID
- Initiation timestamp
- Verified payment timestamp
- Failure/cancellation/expiry information (safe reason/code)
- Callback/event processing status
- Idempotency/replay identifier
- Created/updated timestamps

Avoid storing:

- Wallet PINs or OTPs
- Full payment credentials
- Merchant secrets
- Full raw callback bodies indefinitely
- Sensitive personal information not required for business, compliance, or reconciliation

Use database transactions for related changes. Add appropriate indexes and unique constraints. Include migrations that are safe for the existing production data and explain any backfill needed.

---

## 11. Security Controls

Implement and verify these protections:

### API and application security
- Server-side validation for all payment requests.
- Authentication and authorization for customer payment initiation and payment-status access.
- Rate limiting on payment initiation, status queries, and public callback endpoints as appropriate; rate limiting must not break provider callback delivery.
- CSRF protection for normal authenticated web actions where applicable.
- Strict CORS policy; never use wildcard origins with credentials.
- HTTPS for production checkout, API, callbacks, and return URLs.
- Validate and constrain redirect URLs to prevent open redirects.
- Prevent IDOR/BOLA: users must not query or initiate payment for another user's order.
- Prevent mass assignment of payment status or provider fields.
- Safe error handling without stack traces or secrets.
- Security headers consistent with existing application deployment.
- Protect against SQL injection, XSS, SSRF, and injection through provider callback data using framework-safe practices.
- Never allow a customer to choose arbitrary amount, provider transaction ID, or payment status.

### Cryptographic security
- Follow the official provider's exact cryptographic protocol.
- Do not invent or change hash field ordering, canonicalization, encoding, character sets, or signing algorithm.
- Use cryptographically secure randomness for IDs/tokens.
- Use constant-time signature comparisons.
- Keep secrets outside source control.
- Do not log signed secrets, API credentials, OTPs, PINs, or full sensitive payment payloads.

### Logging and monitoring
- Log payment attempt IDs, order references (safely), provider, event type, result, and correlation IDs.
- Redact sensitive data.
- Avoid logging complete callback payloads by default.
- Log suspicious signature failures, amount mismatches, replay attempts, and duplicate events.
- Logs must not be exposed to customers.
- Use consistent structured logging if the existing project supports it.

---

## 12. Environment Configuration

Create or update the environment configuration and example template without adding real credentials.

Use placeholders only. Names should match the actual implementation and official merchant specifications.

Example naming convention (adapt to the project/provider docs):

```dotenv
# Payment environment
PAYMENTS_ENV=sandbox

# JazzCash — server-side secrets only
JAZZCASH_MERCHANT_ID=
JAZZCASH_PASSWORD=
JAZZCASH_INTEGRITY_SALT=
JAZZCASH_API_BASE_URL=
JAZZCASH_RETURN_URL=

# Easypaisa — server-side secrets only
EASYPAISA_STORE_ID=
EASYPAISA_ACCOUNT_NUMBER=
EASYPAISA_HASH_KEY=
EASYPAISA_API_BASE_URL=
EASYPAISA_RETURN_URL=
```

**Important:** These names are examples, not a claim that every provider uses these exact credentials or environment variables. Adapt to the current official API specification.

- Update `.env.example` or equivalent with empty placeholders only.
- Confirm actual `.env` is gitignored.
- Do not print actual secrets during debugging.
- Do not expose server environment variables through frontend configuration.
- Support sandbox/test configuration separately from production.
- Fail startup or disable a provider safely if required configuration is missing. Never silently fall back to insecure or fake payment behavior.

---

## 13. Sandbox and Testing Requirements

Do not use real money during development or testing.

Use merchant-provided sandbox/test credentials, official test endpoints, and provider test scenarios.

### Required test cases

#### Checkout
- JazzCash option appears and can initiate a payment.
- Easypaisa option appears and can initiate a payment.
- Customer cannot submit an invalid order.
- Customer cannot change the server-calculated amount.
- Unauthorized users cannot pay for another customer's order.
- Double-click/repeated initiation does not create unintended duplicate payment attempts.

#### Payment verification
- Valid verified success updates payment to `paid`.
- Pending payment remains pending.
- Failed payment remains failed/non-paid.
- Cancelled payment remains non-paid.
- Expired payment remains non-paid.
- Invalid signature/hash is rejected.
- Wrong merchant ID is rejected.
- Wrong order/reference is rejected.
- Wrong amount is rejected.
- Wrong currency is rejected.
- Unknown provider transaction ID is rejected.
- Unrecognized provider status is rejected safely.
- Missing required callback fields are rejected.
- Tampered callback is rejected.

#### Replay and race conditions
- Same callback delivered twice.
- Same provider transaction ID used for multiple orders.
- Two callbacks arriving concurrently.
- Callback received after order has been paid.
- Late failure event after verified success.
- Payment initiation retry/timeout with uncertain provider response.
- Duplicate status verification request.

#### Application security
- Payment secrets are absent from frontend build output.
- Secrets do not appear in logs or API responses.
- Payment endpoints enforce authorization.
- Callback endpoints have provider-specific verification.
- Production mode rejects insecure HTTP URLs/configuration.
- Redirects are constrained to trusted destinations.
- Rate limiting and validation work as expected.

Use unit tests for cryptographic utilities and status transitions, integration tests for provider adapters (mocked or sandbox), and end-to-end tests for checkout. Never make tests pass by bypassing verification.

---

## 14. Reconciliation and Uncertain Payment States

Payment APIs can time out after a provider has received the transaction. A timeout does not mean payment failed.

Implement a safe handling strategy:

- Keep the payment attempt in a pending/unknown state when outcome is uncertain.
- Do not create a second charge immediately.
- Query the provider's official transaction-status API if supported.
- Reconcile the attempt using the internal reference and provider transaction ID.
- Provide a safe administrative mechanism to investigate stuck transactions.
- Record reconciliation results and preserve an audit trail.

Do not automatically cancel an order or allow another payment method in a way that creates a duplicate charge unless the business logic safely accounts for the previous attempt.

---

## 15. Refunds

Do not implement refunds unless official API support, merchant permissions, and business requirements are confirmed.

If refunds are not implemented:

- Do not show a fake refund button.
- Do not mark an order as refunded manually through customer endpoints.
- Document the manual refund process for administrators, if one exists.

If refund support is implemented, require authorization, verified provider refund responses, idempotency, audit logging, and a separate refund record/status.

---

## 16. Admin and Customer Payment Status

Customers may view only payment information belonging to their own order.

Admin tools (if they already exist) must:

- Require proper administrator authorization.
- Never allow a simple status dropdown to mark arbitrary payments as paid without verified evidence or an auditable authorized reconciliation procedure.
- Display provider, amount, currency, reference, attempt status, timestamps, and safe failure reason.
- Avoid displaying merchant secrets or sensitive provider data.

Keep order fulfilment actions separate from payment confirmation.

---

## 17. UX and Error Handling

Provide useful, non-sensitive messages such as:

- "Payment is being processed. Please do not retry yet."
- "Payment could not be verified. Your order remains pending."
- "Payment was cancelled. You can try again."
- "Payment confirmed."
- "We could not confirm your payment. Please contact support with your payment reference."

Do not show raw API responses, stack traces, signing data, secret values, or internal database details.

The UI should explain pending states and avoid encouraging duplicate payment attempts.

---

## 18. Documentation Requirements

Add/update project documentation with:

- Which providers are integrated.
- The merchant account prerequisites.
- Sandbox setup.
- Required environment variables.
- Callback/return URL setup in merchant portals.
- How to run tests.
- How to switch from sandbox to production safely.
- Supported payment methods and limitations.
- Payment state machine.
- Callback verification design.
- Reconciliation process for uncertain payments.
- Known gaps or provider approval dependencies.

Never include real merchant credentials in documentation.

---

## 19. Production Readiness Checklist

**Do not declare payment integration production-ready until every applicable item is verified.**

- [ ] Official current docs obtained for both providers and API versions confirmed.
- [ ] Merchant accounts approved and production credentials obtained securely.
- [ ] Sandbox and production configuration separated.
- [ ] HTTPS configured on production endpoints.
- [ ] Secrets are server-side and not committed to Git.
- [ ] Payment initiation is server-side.
- [ ] Server calculates amount and currency.
- [ ] Customer/order ownership verified.
- [ ] Callback/return authenticity verification implemented.
- [ ] Provider status verification implemented where required.
- [ ] Amount, currency, merchant, reference, and transaction match verified.
- [ ] Duplicate callbacks are idempotent.
- [ ] Replay protection implemented.
- [ ] Race conditions and concurrent callbacks tested.
- [ ] Database uniqueness constraints/migrations applied.
- [ ] Payment status transitions enforced.
- [ ] Failed/pending/uncertain payments handled safely.
- [ ] Customer cannot mark payment paid.
- [ ] Sensitive logs redacted.
- [ ] Rate limits and authorization verified.
- [ ] Sandbox success/failure/cancel/pending scenarios tested.
- [ ] Security tests pass.
- [ ] Documentation completed.
- [ ] Production merchant callback URLs reviewed.
- [ ] No test or mock payment path can accidentally be enabled in production.

---

## 20. Agent Execution Rules

Work in small, reviewable steps:

1. **Audit** existing project and summarize relevant architecture.
2. **Plan** implementation and list files expected to change.
3. **Confirm documentation** for the exact merchant APIs; list any blockers or missing merchant credentials.
4. **Implement** provider integrations without disturbing unrelated features.
5. **Add migrations** and review database integrity constraints.
6. **Implement verification** and idempotency before frontend success UI.
7. **Add tests** for successful, failed, pending, invalid, duplicate, replayed, and mismatched payments.
8. **Run existing and new tests**, lint, type-check, and build commands.
9. **Review security** for secrets exposure, trust boundaries, callback validation, authorization, duplicate charges, and unsafe status changes.
10. **Report** exactly what is implemented, tested, and still blocked.

Do not stop after creating payment buttons or a checkout UI. The complete integration includes backend initiation, provider verification, persistence, safe status transitions, duplicate protection, testing, and documentation.

Do not claim tests passed unless they were actually executed. Do not claim provider sandbox or production connectivity was tested unless it was actually tested.

---

## 21. Final Report Format (Required)

At completion, report:

### A. Existing architecture discovered
Briefly describe the project's stack and existing checkout/order flow.

### B. Files changed
List each file created/modified and its purpose.

### C. Provider integrations
Separate JazzCash and Easypaisa. State the exact official API product/version used and whether credentials/docs were available.

### D. Security implemented
List callback signature/hash verification, amount/currency matching, idempotency, replay protection, authorization, secret management, and logging safeguards—only those actually implemented.

### E. Tests executed
List test commands and real results. Distinguish mocked tests from sandbox tests.

### F. Database changes
List migrations, fields, indexes, uniqueness constraints, and state transitions.

### G. Remaining blockers
Explicitly identify merchant approval, credentials, documentation, sandbox access, or production setup that remains pending.

### H. Production readiness
Give one of the following—do not overstate:

- **NOT READY** — critical security/integration work incomplete.
- **SANDBOX VERIFIED** — sandbox flows tested; production not yet verified.
- **PRODUCTION REVIEW REQUIRED** — implementation complete but requires owner/provider review before live payments.
- **PRODUCTION READY** — only if every applicable production checklist item has verifiable evidence and owner approval.

---

## 22. Final Instruction

**Security is more important than speed or visual completion.**

If any payment behavior cannot be securely implemented or verified from official provider documentation, stop that portion, explain the exact blocker, and leave it disabled rather than creating a fake, guessed, insecure, or misleading implementation.

Do not touch unrelated features. Preserve existing functionality. Never commit, publish, or deploy live payment credentials. Never enable real-money processing without explicit owner approval.
