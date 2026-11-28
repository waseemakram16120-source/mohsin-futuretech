/**
 * Live chat between customers and the store (desktop + mobile): guest and
 * signed-in customers, admin inbox, replies without reloading, closing,
 * privacy between browsers, hidden on checkout, accessibility.
 */
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCustomer, signIn } from "./auth-helpers";
import { sql } from "./db";

test.describe.configure({ timeout: 90_000 });
const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function adminInbox(browser: Browser) {
  const admin = await createCustomer({ name: "Chat Admin" });
  await sql("update profiles set role = 'admin' where id = $1", [admin.id]);
  const ctx = await browser.newContext({
    viewport: test.info().project.use.viewport ?? undefined,
    isMobile: test.info().project.use.isMobile,
    hasTouch: test.info().project.use.hasTouch,
  });
  const page = await ctx.newPage();
  await signIn(page, admin.email, admin.password, "/admin/messages");
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
  return { page, ctx };
}

async function openChat(page: Page) {
  await page.getByTestId("chat-launcher").click();
  await expect(page.getByRole("dialog", { name: /Chat with/ })).toBeVisible();
}

test("guest ↔ admin: start, reply without reloading, follow-up, close", async ({ page, browser }) => {
  const name = `Guest ${randomUUID().slice(0, 6)}`;
  await page.goto("/products/leather-belt");
  await openChat(page);
  const panel = page.getByTestId("chat-panel");

  // Validation.
  await panel.getByRole("button", { name: "Start chat" }).click();
  await expect(panel.getByText("Enter your name.")).toBeVisible();
  await expect(panel.getByText("Type a message.")).toBeVisible();
  await panel.getByLabel("Your name").fill(name);
  await panel.getByLabel("Mobile number (optional)").fill("12345");
  await panel.getByLabel("Message").fill("Is the belt available in 36?");
  await panel.getByRole("button", { name: "Start chat" }).click();
  await expect(panel.getByText("Enter a valid Pakistani mobile number, e.g. 0300 1234567.")).toBeVisible();
  await panel.getByLabel("Mobile number (optional)").fill("0333 7778899");
  await panel.getByRole("button", { name: "Start chat" }).click();
  await expect(panel.getByTestId("chat-msg-mine")).toHaveText(/Is the belt available in 36\?/);
  let results = await new AxeBuilder({ page }).include("[data-testid=chat-panel]").withTags(wcag).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  // The admin sees it with an unread badge and replies.
  const { page: admin, ctx } = await adminInbox(browser);
  const row = admin.getByTestId("inbox-row").filter({ hasText: name });
  await expect(row).toContainText("Is the belt available in 36?");
  await expect(row.getByTestId("inbox-unread")).toContainText("1");
  await row.click();
  await expect(admin.getByTestId("inbox-thread")).toContainText("0333 7778899");
  results = await new AxeBuilder({ page: admin }).withTags(wcag).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await admin.getByLabel(`Reply to ${name}`).fill("Yes! Size 36 is in stock in brown.");
  await admin.getByRole("button", { name: "Send reply" }).click();
  await expect(admin.getByTestId("thread-msg-admin")).toHaveText(/Size 36 is in stock/);

  // The guest gets it without reloading.
  await expect(panel.getByTestId("chat-msg-store")).toHaveText(/Size 36 is in stock in brown\./, { timeout: 15_000 });

  // Follow-up (Enter sends) reaches the admin without reloading.
  await panel.getByLabel("Your message").fill("Great, I'll order now.");
  await panel.getByLabel("Your message").press("Enter");
  await expect(panel.getByTestId("chat-msg-mine")).toHaveCount(2);
  await expect(admin.getByTestId("thread-msg-customer")).toHaveCount(2, { timeout: 15_000 });

  // Closing: the guest sees it and can start again.
  await admin.getByRole("button", { name: "Close chat" }).click();
  await expect(admin.getByRole("button", { name: "Reopen" })).toBeVisible();
  await page.reload();
  await openChat(page);
  await expect(panel.getByText("This chat was closed by the store.")).toBeVisible();
  await panel.getByRole("button", { name: "Start a new chat" }).click();
  await expect(panel.getByLabel("Your name")).toBeVisible();
  await ctx.close();
});

test("a chat is private to its browser or account", async ({ page, browser, request }) => {
  await page.goto("/");
  await openChat(page);
  const panel = page.getByTestId("chat-panel");
  await panel.getByLabel("Your name").fill("Private Guest");
  await panel.getByLabel("Message").fill("My secret question");
  await panel.getByRole("button", { name: "Start chat" }).click();
  await expect(panel.getByTestId("chat-msg-mine")).toBeVisible();

  // Another browser sees nothing; a forged cookie is ignored.
  const other = await browser.newContext();
  const res = await other.request.get(new URL("/api/chat", page.url()).toString());
  expect((await res.json()).conversation).toBeNull();
  const [conv] = await sql<{ id: string }>("select id from chat_conversations where customer_name = 'Private Guest' order by created_at desc limit 1");
  await other.addCookies([{ name: "mft_chat", value: `${conv.id}.${"A".repeat(43)}`, url: page.url() }]);
  expect((await (await other.request.get(new URL("/api/chat", page.url()).toString())).json()).conversation).toBeNull();
  const post = await other.request.post(new URL("/api/chat/messages", page.url()).toString(), { data: { message: "intruder" } });
  expect(post.status()).toBe(404);
  await other.close();

  // Customers can't use the admin chat API.
  expect((await request.get("/api/admin/chat")).status()).toBe(403);
  expect((await request.post(`/api/admin/chat/${conv.id}`, { data: { message: "x" } })).status()).toBe(403);
});

test("signed-in customer: details pre-filled, chat follows the account", async ({ page, browser }) => {
  const customer = await createCustomer({ name: "Hamza Ali" });
  await sql("update profiles set phone = '03215556677' where id = $1", [customer.id]);
  await signIn(page, customer.email, customer.password);
  await page.goto("/");
  await openChat(page);
  const panel = page.getByTestId("chat-panel");
  await expect(panel.getByLabel("Your name")).toHaveValue("Hamza Ali");
  await expect(panel.getByLabel("Mobile number (optional)")).toHaveValue("03215556677");
  await panel.getByLabel("Message").fill("When will my order arrive?");
  await panel.getByRole("button", { name: "Start chat" }).click();
  await expect(panel.getByTestId("chat-msg-mine")).toBeVisible();

  const device = await browser.newContext();
  const p2 = await device.newPage();
  await signIn(p2, customer.email, customer.password);
  await p2.goto("/");
  await openChat(p2);
  await expect(p2.getByTestId("chat-panel").getByTestId("chat-msg-mine")).toHaveText(/When will my order arrive\?/);
  await device.close();
});

test("the chat is not shown on checkout or in the admin area", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page.getByTestId("chat-launcher")).toHaveCount(0);
  await page.goto("/access-denied");
  await expect(page.getByTestId("chat-launcher")).toBeVisible();
});
