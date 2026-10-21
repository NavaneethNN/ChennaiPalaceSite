import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const base = process.env.TEST_BASE_URL || "http://localhost:3104";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const dish = {
    id: randomUUID(),
    name: "Masala Dosa",
    category: "Dosa",
    description: "",
    price_cents: 1690,
    stock: null,
  };
  const orders = [];
  const sessionId = randomUUID();
  let token;
  let closed = false;
  await page.route("**/api/menu", (route) => route.fulfill({ json: [dish] }));
  await page.route("**/api/tables", (route) =>
    route.fulfill({
      json: [{ number: 1, status: token && !closed ? "yours" : "available" }],
    }),
  );
  await page.route("**/api/customer-session?*", (route) => {
    assert.equal(route.request().headers()["x-customer-token"], token);
    return route.fulfill({
      json: {
        id: sessionId,
        table: 1,
        closed_at: closed ? new Date().toISOString() : null,
        orders: closed ? [] : orders,
      },
    });
  });
  await page.route("**/api/orders**", (route) => {
    if (route.request().method() === "POST") {
      const data = route.request().postDataJSON();
      if (token) assert.equal(data.customer_token, token);
      else token = data.tracking_token;
      const order = {
        id: randomUUID(),
        status: "pending",
        created_at: new Date().toISOString(),
        items: [
          {
            name: dish.name,
            quantity: data.items[0].quantity,
            price_cents: dish.price_cents,
          },
        ],
        total_cents: dish.price_cents * data.items[0].quantity,
      };
      orders.push(order);
      return route.fulfill({ json: { id: order.id } });
    }
    const id = new URL(route.request().url()).searchParams.get("id");
    return route.fulfill({
      json: {
        ...orders.find((order) => order.id === id),
        closed_at: closed ? new Date().toISOString() : null,
      },
    });
  });
  await page.goto(base + "/order");
  await page
    .getByRole("button", { name: "Add one Masala Dosa", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Table number" }).click();
  await page.getByRole("option", { name: "Table 1 Available" }).click();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await page.locator(".order-history-entry").waitFor();
  orders[0].status = "accepted";
  await page.getByRole("button", { name: "Order more dishes" }).click();
  assert.equal(await page.locator(".order-history-entry").count(), 1);
  await page
    .getByRole("button", { name: "Add one Masala Dosa", exact: true })
    .click();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".order-history-entry").length === 2,
  );
  assert.match(
    await page.locator(".order-history-entry").first().innerText(),
    /Accepted/,
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".order-history-entry").length === 2,
  );
  await page.getByRole("button", { name: "Order more dishes" }).click();
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".order-history-entry").length === 2,
  );
  await page.getByRole("link", { name: "Browse menu" }).click();
  await page.getByRole("link", { name: /View order history/ }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".order-history-entry").length === 2,
  );
  assert.equal(
    await page.locator(".order-session-history").getAttribute("open"),
    "",
  );
  const notes = page.getByPlaceholder("Any special requests?");
  await notes.fill("Less spicy please");
  const position = () =>
    page.evaluate(() => ({
      scroll: scrollY,
      menu:
        document.querySelector(".order-layout").getBoundingClientRect().top +
        scrollY,
    }));
  const beforeUpdate = await position();
  orders.push({ ...orders[0], id: randomUUID(), status: "pending" });
  await page.waitForFunction(
    () => document.querySelectorAll(".order-history-entry").length === 3,
  );
  assert.deepEqual(await position(), beforeUpdate);
  assert.equal(await notes.inputValue(), "Less spicy please");
  assert.equal(
    await notes.evaluate((el) => el === document.activeElement),
    true,
  );
  closed = true;
  await page.locator(".order-session-history").waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("palace_customer_session"),
    ),
    null,
  );
  console.log(
    "PASS session history: multiple orders, live status, browse/reload recovery, closure cleanup",
  );
} finally {
  await browser.close();
}
