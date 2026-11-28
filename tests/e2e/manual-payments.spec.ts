/**
 * Manual Easypaisa payment (proposal §4 / §6): pay the store's account,
 * submit Transaction ID + receipt, see "Pending Verification". Nothing the
 * customer submits can approve or pay an order.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { sql } from "./db";
import { TEST_WALLETS } from "./global-setup";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await sql("update product_variants set stock_quantity = 50 where product_id = (select id from products where slug = 'leather-bifold-wallet')");
});

const WALLET = "/products/leather-bifold-wallet"; // Rs 2,499 + Rs 250 delivery
const TOTAL = "Rs 2,749";

// A real 1×1 PNG, and a text file pretending to be one.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const FAKE_PNG = Buffer.from("this is not an image, just text");

let txnCounter = 0;
const txn = () => `EP${Date.now().toString().slice(-8)}${++txnCounter}${test.info().project.name.length}`;

async function placeEasypaisaOrder(page: Page) {
  await page.goto(WALLET);
  const first = page.locator('input[type=radio][name^="size-"]:not([disabled])').first();
  const size = (await first.getAttribute("value"))!;
  await page.locator("label", { has: page.getByRole("radio", { name: size, exact: true }) }).click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await page.goto("/checkout");
  await page.getByLabel("Full name", { exact: true }).fill("Ayesha Siddiqui");
  await page.getByLabel("Mobile number", { exact: true }).fill("0345 7654321");
  await page.getByLabel("Delivery address", { exact: true }).fill("Flat 12, Block B, Gulshan-e-Iqbal");
  await page.getByLabel("City", { exact: true }).fill("Karachi");
  await page.getByRole("radio", { name: /Easypaisa/ }).check();
  await expect(page.getByTestId("manual-payment-note")).toContainText("Pending Verification");
  await page.getByRole("button", { name: /^Place order · / }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/orders\/MF-\d{6}-\d{5,}\?placed=1$/);
  return (await page.getByTestId("order-number").textContent())!.trim();
}

async function dbPayment(orderNumber: string) {
  const [row] = await sql<{ payment_status: string; status: string; records: { status: string; transaction_id: string | null; receipt_path: string | null }[] }>(
    `select o.payment_status, o.status,
            coalesce((select json_agg(json_build_object('status', p.status, 'transaction_id', p.transaction_id, 'receipt_path', p.receipt_path) order by p.seq)
                        from payments p where p.order_id = o.id), '[]') as records
       from orders o where o.order_number = $1`,
    [orderNumber],
  );
  return row;
}

async function fillEvidence(page: Page, transactionId: string, file = PNG, name = "receipt.png") {
  await page.getByLabel("Transaction ID").fill(transactionId);
  await page.getByLabel("Payment receipt (screenshot)").setInputFiles({ name, mimeType: "image/png", buffer: file });
}

test("Easypaisa order shows the store account, exact amount and steps", async ({ page }) => {
  const number = await placeEasypaisaOrder(page);
  await expect(page.getByText("Payment: Awaiting Payment")).toBeVisible();
  const panel = page.getByTestId("manual-payment-panel");
  await expect(panel.getByTestId("wallet-account-name")).toHaveText(TEST_WALLETS.easypaisa.name);
  await expect(panel.getByTestId("wallet-account-number")).toHaveText(TEST_WALLETS.easypaisa.number);
  await expect(panel.getByTestId("wallet-amount")).toHaveText(TOTAL);
  await expect(panel).toContainText(number);
  await expect(panel).toContainText("We never ask for your PIN or OTP");
  expect(await dbPayment(number)).toMatchObject({ payment_status: "awaiting_payment", status: "pending" });

  const results = await new AxeBuilder({ page }).include("[data-testid=manual-payment-panel]").analyze();
  expect(results.violations).toEqual([]);
});

test("validation: Transaction ID and receipt are required; fake images are refused by the server", async ({ page }) => {
  const number = await placeEasypaisaOrder(page);
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByText("Enter the Transaction ID from your payment receipt.")).toBeVisible();
  await expect(page.getByText("Attach a screenshot or photo of your payment receipt.")).toBeVisible();
  await expect(page.getByLabel("Transaction ID")).toBeFocused();

  await page.getByLabel("Transaction ID").fill("bad id!");
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByText("Transaction ID should be 6–40 letters or numbers (no spaces).")).toBeVisible();

  // Text dressed up as a PNG passes the browser check but not the server's byte check.
  await fillEvidence(page, txn(), FAKE_PNG, "receipt.png");
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByTestId("evidence-error")).toHaveText("Upload the receipt as a JPG, PNG or WebP image.");
  expect(await dbPayment(number)).toMatchObject({ payment_status: "awaiting_payment" });
  const [{ n }] = await sql<{ n: string }>(
    "select count(*) as n from storage.objects where bucket_id = 'payment-receipts' and name like (select id::text from orders where order_number = $1) || '/%'",
    [number],
  );
  expect(Number(n)).toBe(0);
});

test("valid evidence → Pending Verification; duplicates refused; rejection allows a corrected resubmission", async ({ page }) => {
  const number = await placeEasypaisaOrder(page);
  const first = txn();
  await fillEvidence(page, first);
  await expect(page.getByRole("img", { name: "Receipt preview" })).toBeVisible();
  await page.getByRole("button", { name: "Submit payment details" }).click();

  await expect(page.getByTestId("payment-message")).toContainText(`Pending Verification — we received your payment details (Transaction ID ${first})`);
  await expect(page.getByRole("button", { name: "Submit payment details" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Payment: Pending Verification")).toBeVisible();
  await expect(page.getByTestId("payment-message")).toContainText(first);

  const state = await dbPayment(number);
  expect(state.payment_status).toBe("pending_verification");
  expect(state.status).toBe("pending"); // only an admin approval confirms it
  expect(state.records).toHaveLength(1);
  expect(state.records[0].receipt_path).toMatch(/^[0-9a-f-]{36}\/receipt-\d+-[a-z2-9]{10}\.png$/);
  const [{ n }] = await sql<{ n: string }>("select count(*) as n from storage.objects where bucket_id = 'payment-receipts' and name = $1", [
    state.records[0].receipt_path,
  ]);
  expect(Number(n)).toBe(1);

  // A second submission while under review is refused.
  const again = await page.request.post("/api/payments/evidence", {
    multipart: { orderNumber: number, transactionId: txn(), receipt: { name: "r.png", mimeType: "image/png", buffer: PNG } },
  });
  expect(again.status()).toBe(409);

  // Admin rejects (simulated in the database; review_payment is covered by DB tests).
  await sql(
    `with o as (select id from orders where order_number = $1)
     update payments set status = 'rejected', review_note = 'Amount on the receipt does not match', reviewed_at = now()
      where order_id = (select id from o)`,
    [number],
  );
  await sql("update orders set payment_status = 'rejected' where order_number = $1", [number]);

  await page.reload();
  await expect(page.getByTestId("payment-message")).toContainText("We could not verify your payment: Amount on the receipt does not match");
  await expect(page.getByRole("heading", { name: "Submit your payment details again" })).toBeVisible();

  // The same (rejected) Transaction ID can be corrected and sent again.
  const second = txn();
  await fillEvidence(page, second);
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByTestId("payment-message")).toContainText(second);
  const after = await dbPayment(number);
  expect(after.payment_status).toBe("pending_verification");
  expect(after.records.map((r) => r.status)).toEqual(["rejected", "pending_verification"]);
});

test("a Transaction ID already under review on another order is refused", async ({ page }) => {
  const id = txn();
  await placeEasypaisaOrder(page);
  await fillEvidence(page, id);
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByTestId("payment-message")).toContainText("Pending Verification");

  const number = await placeEasypaisaOrder(page);
  await fillEvidence(page, id);
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByTestId("evidence-error")).toHaveText("This Transaction ID has already been submitted. Please check the ID on your receipt.");
  expect(await dbPayment(number)).toMatchObject({ payment_status: "awaiting_payment", records: [{ transaction_id: null }] });
});

test("evidence API: other browsers, foreign origins and bad input are refused", async ({ page, browser }) => {
  const number = await placeEasypaisaOrder(page);
  const receipt = { name: "r.png", mimeType: "image/png", buffer: PNG };

  // Another browser (no order cookie, not signed in) cannot submit — no IDOR.
  const stranger = await browser.newContext();
  const res = await stranger.request.post(new URL("/api/payments/evidence", page.url()).toString(), {
    multipart: { orderNumber: number, transactionId: txn(), receipt },
  });
  expect(res.status()).toBe(404);
  await stranger.close();

  const foreign = await page.request.post("/api/payments/evidence", {
    headers: { origin: "https://evil.example" },
    multipart: { orderNumber: number, transactionId: txn(), receipt },
  });
  expect(foreign.status()).toBe(403);

  const extra = await page.request.post("/api/payments/evidence", {
    multipart: { orderNumber: number, transactionId: txn(), receipt, status: "approved" },
  });
  expect(extra.status()).toBe(400);

  const json = await page.request.post("/api/payments/evidence", { data: { orderNumber: number, transactionId: txn() } });
  expect(json.status()).toBe(400);

  const noFile = await page.request.post("/api/payments/evidence", { multipart: { orderNumber: number, transactionId: txn() } });
  expect(noFile.status()).toBe(400);

  const big = await page.request.post("/api/payments/evidence", {
    multipart: { orderNumber: number, transactionId: txn(), receipt: { ...receipt, buffer: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]) } },
  });
  expect([400, 413]).toContain(big.status());

  expect(await dbPayment(number)).toMatchObject({ payment_status: "awaiting_payment" });
});
