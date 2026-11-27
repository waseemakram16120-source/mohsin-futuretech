/**
 * Customer accounts (proposal §2): registration, login, password reset,
 * profile, saved addresses and wishlist sync — on desktop and mobile.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, createCustomer, latestEmail, signIn, uniqueEmail } from "./auth-helpers";
import { sql } from "./db";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`)).toEqual([]);
}

async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/\?signedOut=1$/);
}

test.describe("access control", () => {
  test("account pages send signed-out visitors to sign in, then back", async ({ page }) => {
    await page.goto("/account/addresses");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Faddresses$/);
    const user = await createCustomer();
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account\/addresses$/);
  });

  test("sign-in never redirects to another site", async ({ page }) => {
    const user = await createCustomer();
    for (const next of ["https://evil.example/", "//evil.example", "/\\evil.example"]) {
      await signIn(page, user.email, user.password, next);
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/account$/);
      await signOut(page);
    }
  });

  test("email links with a foreign next stay on this site", async ({ page }) => {
    const res = await page.request.get("/auth/confirm?token_hash=bogus&type=recovery&next=https://evil.example", { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(res.headers().location).toMatch(/^http:\/\/localhost:\d+\/login\?error=link$/);
    await page.goto("/auth/confirm?code=bogus&next=//evil.example");
    await expect(page).toHaveURL(/\/login\?error=link$/);
    await expect(page.getByText("That link is invalid or has expired.")).toBeVisible();
  });
});

test.describe("sign-up and sign-in", () => {
  test("sign-up validates, creates the account and signs in", async ({ page }) => {
    await page.goto("/signup");
    await axe(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your full name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.").or(page.getByText("Enter your email address."))).toBeVisible();

    const email = uniqueEmail("signup");
    await page.getByLabel("Full name").fill("Hira Qureshi");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("short2");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    // What was typed (except passwords) is kept.
    await expect(page.getByLabel("Email")).toHaveValue(email);

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Show password" }).first().click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "Hi, Hira" })).toBeVisible();
    await expect(page.getByText("No orders yet")).toBeVisible();

    const [profile] = await sql<{ full_name: string; role: string }>("select full_name, role from profiles where email = $1", [email]);
    expect(profile).toEqual({ full_name: "Hira Qureshi", role: "customer" });

    // Same email again → clear message.
    await signOut(page);
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Someone Else");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("An account with this email already exists. Sign in instead.")).toBeVisible();
  });

  test("wrong password and unknown email give the same message; sign out ends the session", async ({ page }) => {
    const user = await createCustomer();
    await page.goto("/login");
    await axe(page);
    for (const [email, password] of [[user.email, "WrongPass123"], [uniqueEmail("nobody"), PASSWORD]]) {
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByTestId("form-message")).toHaveText("Email or password is incorrect.");
    }
    await signIn(page, user.email);
    await expect(page).toHaveURL(/\/account$/);
    await signOut(page);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password: same answer for any email; the emailed link sets a new password", async ({ page }) => {
    const user = await createCustomer();
    await page.goto("/forgot-password");
    await axe(page);
    await page.getByLabel("Email").fill(uniqueEmail("ghost"));
    await page.getByRole("button", { name: "Send reset link" }).click();
    const generic = "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour.";
    await expect(page.getByTestId("form-message")).toHaveText(generic);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("form-message")).toHaveText(generic);

    const mail = await latestEmail(user.email);
    expect(mail.subject).toBe("Reset your Mohsin FutureTech password");
    const href = mail.html.match(/href="([^"]+)"/)![1].replace(/&amp;/g, "&");
    const link = new URL(href);
    expect(link.pathname).toBe("/auth/confirm");
    // The template uses the project's site URL; open the same path on the test server.
    await page.goto(`${link.pathname}${link.search}`);
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByText(`For ${user.email}.`)).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill("NewPass2026");
    await page.getByLabel("Confirm new password").fill("NewPass2026");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL(/\/account\?updated=password$/);
    await expect(page.getByText("Your password has been changed.")).toBeVisible();

    // The link is single-use.
    await signOut(page);
    await page.goto(`${link.pathname}${link.search}`);
    await expect(page).toHaveURL(/\/login\?error=link$/);

    await signIn(page, user.email, "NewPass2026");
    await expect(page).toHaveURL(/\/account$/);
  });
});

test.describe("profile and addresses", () => {
  test("profile: name and phone are validated and saved", async ({ page }) => {
    const user = await createCustomer({ name: "Umar Farooq" });
    await signIn(page, user.email, user.password, "/account/profile");
    await expect(page.getByLabel("Email")).toHaveValue(user.email);
    await expect(page.getByLabel("Email")).toBeDisabled();
    await axe(page);

    await page.getByLabel("Mobile number").fill("12345");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Enter a valid Pakistani mobile number, e.g. 0300 1234567.")).toBeVisible();

    await page.getByLabel("Full name").fill("Umar  Farooq Khan");
    await page.getByLabel("Mobile number").fill("+92 321 7654321");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByTestId("form-message")).toHaveText("Profile saved.");
    const [row] = await sql<{ full_name: string; phone: string }>("select full_name, phone from profiles where id = $1", [user.id]);
    expect(row).toEqual({ full_name: "Umar Farooq Khan", phone: "03217654321" });
  });

  test("addresses: add, default, edit, delete", async ({ page }) => {
    const user = await createCustomer();
    await signIn(page, user.email, user.password, "/account/addresses");
    await expect(page.getByText("No saved addresses")).toBeVisible();
    await axe(page);

    // Validation.
    await page.getByRole("button", { name: "Add a new address" }).click();
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Enter your full name.")).toBeVisible();
    await expect(page.getByText("Enter the full address (house, street, area).")).toBeVisible();

    const form = page.getByRole("form", { name: "New address" });
    await form.getByLabel("Full name").fill("Sana Malik");
    await form.getByLabel("Mobile number").fill("0300 1112223");
    await form.getByLabel("City").fill("Lahore");
    await form.getByLabel("Address", { exact: true }).fill("House 5, Street 9, Model Town");
    await form.getByLabel("Province").selectOption("Punjab");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByTestId("address-notice")).toHaveText("Address added.");
    const cards = page.getByTestId("address-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Default"); // first address is the default

    await page.getByRole("button", { name: "Add a new address" }).click();
    const second = page.getByRole("form", { name: "New address" });
    await second.getByLabel("Label").fill("Office");
    await second.getByLabel("Full name").fill("Sana Malik");
    await second.getByLabel("Mobile number").fill("0300 1112223");
    await second.getByLabel("City").fill("Lahore");
    await second.getByLabel("Address", { exact: true }).fill("Office 3, Gulberg III, Main Boulevard");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: "Office" })).not.toContainText("Default");

    await cards.filter({ hasText: "Office" }).getByRole("button", { name: "Make default" }).click();
    await expect(page.getByTestId("address-notice")).toHaveText("Default address updated.");
    await expect(cards.first()).toContainText("Office"); // default listed first
    const defaults = await sql<{ label: string }>("select label from addresses where user_id = $1 and is_default", [user.id]);
    expect(defaults).toEqual([{ label: "Office" }]);

    await page.getByRole("button", { name: "Edit Home address" }).click();
    const edit = page.getByRole("form", { name: "Edit address" });
    await edit.getByLabel("Postal code").fill("54000");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByTestId("address-notice")).toHaveText("Address updated.");
    await expect(cards.filter({ hasText: "Home" })).toContainText("54000");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete Office address" }).click();
    await expect(page.getByTestId("address-notice")).toHaveText("Address deleted.");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Default"); // remaining one promoted
  });
});

test("wishlist follows the account to another device and leaves on sign-out", async ({ page, browser }) => {
  const user = await createCustomer();
  // As a guest, save a product.
  await page.goto("/products/leather-belt");
  await page.getByRole("button", { name: "Save Leather Belt to wishlist" }).first().click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("mft.wishlist.v1") ?? "[]").length)).toBe(1);

  // Signing in merges it into the account.
  await signIn(page, user.email);
  await expect
    .poll(async () => (await sql<{ n: string }>("select count(*) as n from wishlist where user_id = $1", [user.id]))[0].n)
    .toBe("1");

  // Another device signs in and sees it.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, user.email);
  await otherPage.goto("/wishlist");
  await expect(otherPage.getByText("Leather Belt").first()).toBeVisible();
  await other.close();

  // Signing out removes the account's wishlist from this browser.
  await signOut(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("mft.wishlist.v1") ?? "[]").length)).toBe(0);
});
