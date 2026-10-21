import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.env.TEST_BASE_URL || "http://localhost:3102";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  // Exercise customer interactions without changing restaurant data.
  const groups = JSON.parse(
    await readFile(new URL("../src/lib/menu.json", import.meta.url), "utf8"),
  );
  const menu = groups.flatMap((group, groupIndex) =>
    group.items.map((item, index) => ({
      id: `dish-${groupIndex}-${index}`,
      category: group.title,
      name: item.name,
      description: item.description,
      price_cents: Math.round(Number(item.price.replace(/[^0-9.]/g, "")) * 100),
      stock: item.name === "Masala Dosa" ? 2 : null,
    })),
  );
  menu[0].stock = 0;
  await page.route("**/api/menu", (route) => route.fulfill({ json: menu }));
  await page.route("**/api/tables", (route) =>
    route.fulfill({
      json: [
        { number: 1, status: "available" },
        { number: 2, status: "occupied" },
        { number: 3, status: "available" },
      ],
    }),
  );
  const errors = [];
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/order`);
    const dish = page.locator(".order-dish").first();
    await dish.waitFor();
    const box = await dish.boundingBox();
    assert.ok(
      box && box.y + box.height < 760,
      `A complete dish must be visible without scrolling at ${width}px`,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const dosa = page.locator(".order-dish").filter({
    has: page.getByRole("heading", { name: "Masala Dosa", exact: true }),
  });
  const initialDishHeight = (await dosa.boundingBox()).height;
  await dosa
    .getByRole("button", { name: "Add one Masala Dosa", exact: true })
    .click();
  assert.equal((await dosa.boundingBox()).height, initialDishHeight);
  await page
    .getByRole("status")
    .filter({ hasText: "Masala Dosa added to your order" })
    .waitFor();
  await page.getByText("1 item in your order", { exact: true }).waitFor();
  await dosa
    .getByRole("button", { name: "Add one Masala Dosa", exact: true })
    .click();
  assert.equal(
    await dosa
      .getByRole("button", { name: "Add one Masala Dosa", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByText("2 items in your order", { exact: true }).waitFor();
  await dosa
    .getByRole("button", { name: "Remove one Masala Dosa", exact: true })
    .click();
  await dosa
    .getByRole("button", { name: "Remove one Masala Dosa", exact: true })
    .click();
  await dosa
    .getByRole("button", { name: "Add one Masala Dosa", exact: true })
    .waitFor();
  assert.equal(await dosa.locator(".order-in-cart").isVisible(), false);
  await page
    .getByRole("searchbox", { name: "Search dishes" })
    .fill("no-such-dish");
  await page
    .getByRole("heading", { name: "Nothing matched that search." })
    .waitFor();
  await page.getByRole("button", { name: "Show all dishes" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await dosa
    .getByRole("button", { name: "Add one Masala Dosa", exact: true })
    .click();
  assert.equal(
    await dosa
      .locator(".order-quantity-pop")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.screenshot({ path: "/tmp/palace-order-menu-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });

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
  await page.getByRole("heading", { name: "What are you craving?" }).waitFor();
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
  const tableSelect = page.getByRole("combobox", { name: "Table number" });
  await tableSelect.click();
  assert.equal(
    await page
      .getByRole("option", { name: "Table 2 In use" })
      .getAttribute("aria-disabled"),
    "true",
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.match(await tableSelect.innerText(), /Table 3/);
  await tableSelect.click();
  await page.keyboard.press("Escape");
  assert.equal(await tableSelect.getAttribute("aria-expanded"), "false");
  await page.getByRole("dialog", { name: "Your order" }).waitFor();
  await tableSelect.click();
  await page.getByRole("option", { name: "Table 1 Available" }).click();
  assert.match(await tableSelect.innerText(), /Table 1/);
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
    .getByRole("button", { name: "Place order" })
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
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/order`);
  await page.locator(".order-dish").first().waitFor();
  const notes = page.getByPlaceholder("Any special requests?");
  await notes.fill("Please bring the drinks first");
  const menuPosition = () =>
    page
      .locator(".order-category")
      .first()
      .evaluate((el) => ({
        top: el.getBoundingClientRect().top,
        scroll: scrollY,
      }));
  const beforeRefresh = await menuPosition();
  const originalName = menu[0].name;
  menu[0] = { ...menu[0], name: "Updated kitchen special" };
  menu.unshift({ ...menu[1], id: "new-special", name: "New kitchen special" });
  const refreshMenu = page.getByRole("button", {
    name: "Refresh updated menu",
  });
  await refreshMenu.waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: originalName, exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("heading", { name: "New kitchen special", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(await menuPosition(), beforeRefresh);
  assert.equal(
    await notes.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await notes.inputValue(), "Please bring the drinks first");
  await refreshMenu.click();
  await page
    .getByRole("heading", { name: "New kitchen special", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS menu visibility, add/remove feedback, stock limits, search, reduced motion, preselection, pairings and mobile cart",
  );
} finally {
  await browser.close();
}
