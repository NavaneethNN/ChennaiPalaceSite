import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.TEST_BASE_URL || "http://localhost:3102";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/menu`);
  await page.getByRole("heading", { name: "A little inspiration." }).waitFor();
  await page.screenshot({
    path: "/tmp/palace-menu-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Add Masala Dosa to your table order" })
    .click();
  await page.getByRole("heading", { name: /Good food/ }).waitFor();
  await page.getByText("1 × Masala Dosa").waitFor();
  assert.equal(await page.locator(".order-pairing").count(), 2);
  await page.screenshot({
    path: "/tmp/palace-upsell-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const cartButton = page.getByRole("button", { name: "View cart" });
  await cartButton.waitFor();
  await page.locator("#your-order").waitFor({ state: "hidden" });
  await page.evaluate(() => scrollTo(0, 1800));
  await cartButton.click();
  await page.getByRole("dialog", { name: "Your order" }).waitFor();
  assert.equal(await page.locator(".order-pairing").count(), 2);
  await page.waitForFunction(
    () =>
      Math.abs(
        document.querySelector("#your-order").getBoundingClientRect().bottom -
          innerHeight,
      ) < 2,
  );
  await page.locator(".order-pairing").first().locator("button").click();
  await page.getByText("2 items in your order").waitFor();
  const submit = await page
    .getByRole("button", { name: "Send order to cashier" })
    .boundingBox();
  assert.ok(
    submit && submit.y + submit.height <= 844,
    "Submit action should stay visible inside the drawer",
  );
  await page.screenshot({ path: "/tmp/palace-upsell-mobile.png" });
  await page.getByRole("button", { name: "Close cart" }).last().click();
  await page.locator("#your-order").waitFor({ state: "hidden" });
  await cartButton.click();
  await page.keyboard.press("Escape");
  await page.locator("#your-order").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).waitFor();
  assert.ok(
    await page
      .locator(".mobile-nav > a")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) <= 18),
  );
  await page.getByRole("button", { name: "Close navigation" }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.goto(`${base}/menu`);
  await page.getByRole("heading", { name: "A little inspiration." }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "/tmp/palace-menu-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS menu-to-order preselection, pairings, mobile cart and layouts",
  );
} finally {
  await browser.close();
}
