import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const base = process.env.TEST_BASE_URL || "http://localhost:3104";
try {
  for (const width of [1440, 1100, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(() => {
      window.EventSource = class {
        handlers = {};
        constructor() {
          this.listener = () => this.handlers.change?.();
          window.addEventListener("test-orders-change", this.listener);
          setTimeout(() => this.handlers.ready?.(), 0);
        }
        addEventListener(name, callback) {
          this.handlers[name] = callback;
        }
        close() {
          window.removeEventListener("test-orders-change", this.listener);
        }
      };
    });
    let pending = [];
    const makeOrder = (index) => ({
      id: `order-${index}`,
      session_id: "session-1",
      status: "pending",
      created_at: new Date(1700000000000 + index * 1000).toISOString(),
      decided_at: null,
      notes: "",
      items: [
        {
          id: `item-${index}`,
          name: "Masala Dosa",
          quantity: 1,
          price_cents: 1690,
          printer: "kitchen",
        },
      ],
    });
    await page.route("**/api/auth", (r) =>
      r.fulfill({
        json: {
          role: "cashier",
          name: "Test cashier",
          cashier_id: "cashier-1",
        },
      }),
    );
    await page.route("**/api/operations", (r) =>
      r.fulfill({
        json: [
          {
            id: "session-1",
            table_number: 1,
            opened_at: new Date().toISOString(),
            closed_at: null,
            total_cents: 0,
            orders: pending,
          },
        ],
      }),
    );
    await page.goto(base + "/cashier");
    const queue = page.getByRole("region", { name: "Incoming order queue" });
    await queue.waitFor();
    const panel = page.locator(".ops-service-grid > section").nth(1);
    const position = () =>
      panel.evaluate((el) => el.getBoundingClientRect().top + scrollY);
    const before = await position();
    const queueHeight = (await queue.boundingBox()).height;
    pending = Array.from({ length: 5 }, (_, i) => makeOrder(i));
    await page.evaluate(() =>
      window.dispatchEvent(new Event("test-orders-change")),
    );
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".ops-incoming-list .ops-order").length === 5,
    );
    assert.ok(
      Math.abs((await position()) - before) < 1,
      "First arrivals must not shift table workspace",
    );
    assert.equal((await queue.boundingBox()).height, queueHeight);
    await queue.evaluate((el) => {
      el.scrollTop = 100;
      el.focus({ preventScroll: true });
    });
    const scroll = await page.evaluate(() => ({
      page: scrollY,
      queue: document.querySelector(".ops-incoming-list").scrollTop,
    }));
    pending = [...pending, makeOrder(5)];
    await page.evaluate(() =>
      window.dispatchEvent(new Event("test-orders-change")),
    );
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".ops-incoming-list .ops-order").length === 6,
    );
    assert.ok(Math.abs((await position()) - before) < 1);
    assert.deepEqual(
      await page.evaluate(() => ({
        page: scrollY,
        queue: document.querySelector(".ops-incoming-list").scrollTop,
      })),
      scroll,
    );
    assert.equal(
      await queue.evaluate((el) => el === document.activeElement),
      true,
    );
    console.log(
      `PASS ${width}px: arrivals preserve workspace position, queue height, scrolling and focus`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
