import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";
import { chromium } from "@playwright/test";
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});
const createdItems = [];
const orderIds = [];
const sessionIds = [];
let cashierId;
let adminCookie = "";
let cashierCookie = "";
let browser;
async function call(
  url,
  { method = "GET", data, cookie, expected = 200 } = {},
) {
  const res = await fetch(base + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const value = await res.json();
  assert.equal(
    res.status,
    expected,
    `${method} ${url}: ${JSON.stringify(value)}`,
  );
  return { value, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
try {
  await client.connect();
  // Select an unused table; cleanup only removes records created by this test.
  const occupied = await client.query(
    "SELECT DISTINCT table_number FROM palace.table_sessions",
  );
  const table = Array.from({ length: 99 }, (_, i) => 999 - i).find(
    (t) => !occupied.rows.some((r) => r.table_number === t),
  );
  assert.ok(table, "An unused test table is required.");
  const login = await call("/api/auth", {
    method: "POST",
    data: { role: "admin", password: process.env.SUPERADMIN_PASSWORD },
  });
  adminCookie = login.cookie;
  await call("/api/admin", { expected: 401 });
  await call("/api/operations", { expected: 401 });
  await call("/api/events", { expected: 401 });
  const crossOrigin = await fetch(base + "/api/operations", {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "close", id: randomUUID() }),
  });
  assert.equal(crossOrigin.status, 403);
  const prefix = `TEST-${randomBytes(4).toString("hex")}`;
  const kitchen = randomUUID(),
    counter = randomUUID();
  createdItems.push(kitchen, counter);
  for (const [id, name, printer, stock, price] of [
    [kitchen, `${prefix} kitchen`, "kitchen", 5, 1000],
    [counter, `${prefix} counter`, "cashier", null, 450],
  ]) {
    await client.query(
      "INSERT INTO palace.menu_items(id,category,name,price_cents,printer,stock) VALUES($1,$2,$3,$4,$5,$6)",
      [id, prefix, name, price, printer, stock],
    );
  }
  const pins = await client.query("SELECT pin FROM palace.cashiers");
  const pin = Array.from({ length: 1000 }, (_, i) =>
    String(i).padStart(4, "0"),
  ).find((p) => !pins.rows.some((r) => r.pin === p));
  await call("/api/admin", {
    method: "POST",
    cookie: adminCookie,
    data: {
      kind: "cashier",
      name: prefix,
      pin,
      password: "1357",
      active: true,
    },
  });
  const cashiers = (await call("/api/admin", { cookie: adminCookie })).value
    .cashiers;
  cashierId = cashiers.find((c) => c.name === prefix).id;
  cashierCookie = (
    await call("/api/auth", {
      method: "POST",
      data: { role: "cashier", pin, password: "1357" },
    })
  ).cookie;
  await call("/api/admin", { cookie: cashierCookie, expected: 403 });
  await call("/api/admin", {
    method: "POST",
    cookie: cashierCookie,
    data: { kind: "menu" },
    expected: 403,
  });
  await call("/api/auth", {
    method: "POST",
    data: { role: "cashier", pin, password: "135" },
    expected: 400,
  });
  console.log(
    "PASS staff login, cashier creation and server role restrictions",
  );
  const token = randomUUID(),
    key = randomUUID();
  const data = {
    table_number: table,
    request_key: key,
    tracking_token: token,
    notes: "No chilli please",
    items: [
      { id: kitchen, quantity: 2 },
      { id: counter, quantity: 1 },
    ],
  };
  const first = (await call("/api/orders", { method: "POST", data })).value;
  orderIds.push(first.id);
  const replay = (await call("/api/orders", { method: "POST", data })).value;
  assert.equal(first.id, replay.id);
  await call("/api/orders", {
    method: "POST",
    data: { ...data, tracking_token: randomUUID() },
    expected: 409,
  });
  await call(`/api/orders?id=${first.id}&token=${randomUUID()}`, {
    expected: 404,
  });
  const tracking = (await call(`/api/orders?id=${first.id}&token=${token}`))
    .value;
  assert.equal(tracking.status, "pending");
  let sessions = (await call("/api/operations", { cookie: cashierCookie }))
    .value;
  let session = sessions.find((s) => s.table_number === table);
  sessionIds.push(session.id);
  assert.equal(session.total_cents, 0);
  await call("/api/operations", {
    method: "POST",
    cookie: cashierCookie,
    data: { action: "close", id: session.id },
    expected: 409,
  });
  await call(`/api/kot/${first.id}`, { cookie: cashierCookie, expected: 404 });
  console.log(
    "PASS customer validation, idempotent submission, private tracking and pending close guard",
  );
  await Promise.all(
    [1, 2].map(() =>
      call("/api/operations", {
        method: "POST",
        cookie: cashierCookie,
        data: { id: first.id, action: "accept" },
      }),
    ),
  );
  let stock = (
    await client.query("SELECT stock FROM palace.menu_items WHERE id=$1", [
      kitchen,
    ])
  ).rows[0].stock;
  assert.equal(stock, 3);
  sessions = (await call("/api/operations", { cookie: cashierCookie })).value;
  session = sessions.find((s) => s.table_number === table);
  assert.equal(session.total_cents, 2450);
  for (const printer of ["", "kitchen", "cashier"]) {
    const pdf = await fetch(
      `${base}/api/kot/${first.id}${printer ? `?printer=${printer}` : ""}`,
      { headers: { Cookie: cashierCookie } },
    );
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    const buffer = Buffer.from(await pdf.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    assert.ok(buffer.length > 2000);
    assert.equal(
      (buffer.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
      printer ? 1 : 2,
    );
  }
  await call(`/api/kot/${first.id}`, { expected: 401 });
  console.log(
    "PASS concurrent acceptance, exact stock deduction, table totals and routed KOT PDFs",
  );
  const staleMenu = (
    await call("/api/admin", { cookie: adminCookie })
  ).value.menu.find((i) => i.id === kitchen);
  await client.query("UPDATE palace.menu_items SET stock=stock WHERE id=$1", [
    kitchen,
  ]);
  await call("/api/admin", {
    method: "POST",
    cookie: adminCookie,
    data: { kind: "menu", ...staleMenu, stock: 99 },
    expected: 409,
  });
  console.log(
    "PASS cross-origin rejection, protected events and stale stock edit protection",
  );
  // A snapshot retains its ordered price/destination even after menu changes.
  await call("/api/admin", {
    method: "POST",
    cookie: adminCookie,
    data: {
      kind: "menu",
      id: kitchen,
      version: (
        await client.query(
          "SELECT version FROM palace.menu_items WHERE id=$1",
          [kitchen],
        )
      ).rows[0].version,
      name: `${prefix} kitchen`,
      category: prefix,
      description: "",
      price_cents: 2000,
      printer: "cashier",
      stock: 3,
      active: true,
    },
  });
  const snapshot = (
    await client.query(
      "SELECT price_cents,printer FROM palace.order_items WHERE order_id=$1 AND menu_item_id=$2",
      [first.id, kitchen],
    )
  ).rows[0];
  assert.deepEqual(snapshot, { price_cents: 1000, printer: "kitchen" });
  const nextData = {
    ...data,
    request_key: randomUUID(),
    tracking_token: randomUUID(),
    items: [{ id: kitchen, quantity: 3 }],
  };
  const second = (await call("/api/orders", { method: "POST", data: nextData }))
    .value;
  orderIds.push(second.id);
  await client.query("UPDATE palace.menu_items SET stock=1 WHERE id=$1", [
    kitchen,
  ]);
  await call("/api/operations", {
    method: "POST",
    cookie: cashierCookie,
    data: { id: second.id, action: "accept" },
    expected: 409,
  });
  assert.equal(
    (
      await client.query("SELECT status FROM palace.orders WHERE id=$1", [
        second.id,
      ])
    ).rows[0].status,
    "pending",
  );
  await call("/api/operations", {
    method: "POST",
    cookie: cashierCookie,
    data: { id: second.id, action: "reject" },
  });
  await call("/api/operations", {
    method: "POST",
    cookie: cashierCookie,
    data: {
      id: session.id,
      action: "close",
      expected_total: 0,
      expected_order_count: 1,
    },
    expected: 409,
  });
  await call("/api/operations", {
    method: "POST",
    cookie: cashierCookie,
    data: {
      id: session.id,
      action: "close",
      expected_total: 2450,
      expected_order_count: 2,
    },
  });
  const history = (
    await call("/api/operations?history=1", { cookie: cashierCookie })
  ).value.find((s) => s.id === session.id);
  assert.equal(history.total_cents, 2450);
  assert.ok(history.closed_at);
  const third = (
    await call("/api/orders", {
      method: "POST",
      data: {
        ...data,
        request_key: randomUUID(),
        tracking_token: randomUUID(),
        items: [{ id: counter, quantity: 1 }],
      },
    })
  ).value;
  orderIds.push(third.id);
  const reopened = (
    await call("/api/operations", { cookie: cashierCookie })
  ).value.find((s) => s.table_number === table);
  sessionIds.push(reopened.id);
  assert.notEqual(reopened.id, session.id);
  assert.equal(reopened.total_cents, 0);
  console.log(
    "PASS menu snapshots, stock conflict rollback, rejection, history and fresh table sessions",
  );
  browser = await chromium.launch({ headless: true });
  let page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/admin");
  await page
    .getByLabel("Super admin password", { exact: true })
    .fill(process.env.SUPERADMIN_PASSWORD);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("heading", { name: "Orders & tables" }).waitFor();
  await page.getByRole("button", { name: "Menu & stock" }).click();
  await page.getByRole("button", { name: "Add dish" }).waitFor();
  await page.getByText(`${prefix} counter`, { exact: true }).waitFor();
  await page.getByRole("button", { name: "Add dish" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Close editor").click();
  await page.screenshot({ path: "/tmp/palace-admin.png", fullPage: true });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("heading", { name: "Admin sign in" }).waitFor();
  await page.goto(base + "/cashier");
  await page.getByLabel("4 digit PIN", { exact: true }).fill(pin);
  await page.getByLabel("4 digit password", { exact: true }).fill("1357");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("heading", { name: "Orders & tables" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Menu & stock" }).count(),
    0,
  );
  await page
    .getByText(`#${third.id.slice(0, 8).toUpperCase()}`, { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Accept & open KOT", exact: true })
    .click();
  await page.getByRole("link", { name: "Open latest KOT ↗" }).waitFor();
  assert.equal(
    (
      await client.query("SELECT status FROM palace.orders WHERE id=$1", [
        third.id,
      ])
    ).rows[0].status,
    "accepted",
  );
  await page.locator(".ops-table b").filter({ hasText: "$4.50" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Accept & open KOT", exact: true })
      .count(),
    0,
  );
  await page.screenshot({ path: "/tmp/palace-cashier.png", fullPage: true });
  const cashierPage = page;
  await cashierPage
    .getByText("Live restaurant workspace", { exact: true })
    .waitFor();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/order?table=" + table);
  await page.getByLabel("Search dishes", { exact: true }).fill(prefix);
  await page
    .getByRole("button", { name: `Add one ${prefix} counter`, exact: true })
    .click();
  await page.getByRole("button", { name: "View cart" }).click();
  await page.getByLabel("Table number", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Table number", { exact: true }).inputValue(),
    String(table),
  );
  await page.getByRole("button", { name: "Send order to cashier" }).click();
  await page.getByText("Awaiting cashier", { exact: true }).waitFor();
  const browserOrder = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("palace_order")),
  );
  orderIds.push(browserOrder.id);
  assert.equal(browserOrder.table, table);
  await cashierPage
    .getByText(`#${browserOrder.id.slice(0, 8).toUpperCase()}`, { exact: true })
    .waitFor({ timeout: 4000 });
  console.log(
    "PASS live customer order appears in cashier without manual refresh",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "/tmp/palace-order-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS desktop admin/cashier UI and mobile customer order submission without browser errors",
  );
  await call("/api/admin", {
    method: "POST",
    cookie: adminCookie,
    data: {
      kind: "cashier",
      id: cashierId,
      name: prefix,
      pin,
      password: "",
      active: false,
    },
  });
  await call("/api/operations", { cookie: cashierCookie, expected: 401 });
  console.log("PASS disabled cashier session is revoked");
  console.log("All restaurant integration checks passed.");
} finally {
  await browser?.close();
  if (orderIds.length) {
    await client.query(
      "DELETE FROM palace.order_items WHERE order_id=ANY($1::uuid[])",
      [orderIds],
    );
    await client.query("DELETE FROM palace.orders WHERE id=ANY($1::uuid[])", [
      orderIds,
    ]);
  }
  if (sessionIds.length)
    await client.query(
      "DELETE FROM palace.table_sessions WHERE id=ANY($1::uuid[])",
      [sessionIds],
    );
  if (createdItems.length)
    await client.query(
      "DELETE FROM palace.menu_items WHERE id=ANY($1::uuid[])",
      [createdItems],
    );
  if (cashierId) {
    await client.query(
      "DELETE FROM palace.staff_sessions WHERE cashier_id=$1",
      [cashierId],
    );
    await client.query("DELETE FROM palace.cashiers WHERE id=$1", [cashierId]);
  }
  for (const cookie of [adminCookie, cashierCookie])
    if (cookie)
      await fetch(base + "/api/auth", {
        method: "DELETE",
        headers: { Cookie: cookie },
      }).catch(() => {});
  await client.end();
}
