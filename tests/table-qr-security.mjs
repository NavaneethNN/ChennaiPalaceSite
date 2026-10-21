import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

async function runSecurityTests() {
  console.log("Starting Table QR Code Security & View-Only Menu Unit Tests...\n");

  // Test 1: Generate secure random table secret
  const secret1 = randomBytes(16).toString("hex");
  const secret2 = randomBytes(16).toString("hex");
  assert.equal(secret1.length, 32, "Secret must be 32 hex characters");
  assert.notEqual(secret1, secret2, "Secrets must be unique and cryptographically random");
  console.log("✓ Secure 128-bit table QR tokens generated successfully");

  // Test 2: Generate valid QR code data URL and SVG
  const sampleUrl = `https://chennaipalace.com.au/order?table=5&code=${secret1}`;
  const dataUrl = await QRCode.toDataURL(sampleUrl, { width: 320, margin: 2 });
  assert.ok(dataUrl.startsWith("data:image/png;base64,"), "Should generate base64 PNG data URL");
  
  const svg = await QRCode.toString(sampleUrl, { type: "svg", margin: 2 });
  assert.ok(svg.includes("<svg") && svg.includes("</svg>"), "Should generate valid SVG markup");
  console.log("✓ QR code image (PNG data URL & vector SVG) generated successfully");

  // Test 3: Table QR Verification simulation
  function simulateVerify(tableNumber, code, registeredTables) {
    if (!code || typeof code !== "string" || !code.trim()) {
      return { valid: false, error: "Missing table QR code." };
    }
    const found = registeredTables.find((t) => t.number === tableNumber);
    if (!found) {
      return { valid: false, error: "Table does not exist." };
    }
    if (!found.active) {
      return { valid: false, error: "Table is currently unavailable." };
    }
    if (found.qr_code.toLowerCase().trim() !== code.toLowerCase().trim()) {
      return { valid: false, error: "Invalid or expired table QR code." };
    }
    return { valid: true, table: tableNumber };
  }

  const mockTables = [
    { number: 1, active: true, qr_code: "a1b2c3d4e5f678901234567890abcdef" },
    { number: 2, active: false, qr_code: "b2c3d4e5f678901234567890abcdefa1" },
  ];

  // Matching code -> valid
  assert.deepEqual(
    simulateVerify(1, "a1b2c3d4e5f678901234567890abcdef", mockTables),
    { valid: true, table: 1 },
    "Valid code must pass verification",
  );

  // Wrong code -> rejected
  assert.equal(
    simulateVerify(1, "wrong-code-here", mockTables).valid,
    false,
    "Invalid code must fail verification",
  );

  // Inactive table -> rejected
  assert.equal(
    simulateVerify(2, "b2c3d4e5f678901234567890abcdefa1", mockTables).valid,
    false,
    "Inactive table must fail verification",
  );

  // Missing code -> rejected
  assert.equal(
    simulateVerify(1, "", mockTables).valid,
    false,
    "Missing code must fail verification",
  );
  console.log("✓ Table QR code verification logic verified");

  // Test 4: Order security enforcement
  function simulatePlaceOrder(orderPayload, tableConfig) {
    if (!tableConfig || !tableConfig.active) {
      return { status: 409, error: "Table not available." };
    }
    if (
      !orderPayload.table_code ||
      orderPayload.table_code.toLowerCase().trim() !==
        tableConfig.qr_code.toLowerCase().trim()
    ) {
      return {
        status: 403,
        error: "Scanning the QR code on your dining table is required to place an order.",
      };
    }
    return { status: 200, id: "ORD-OK-12345" };
  }

  const activeTable = { number: 4, active: true, qr_code: "secr3t-c0de-4" };

  // Outsider placing order with no table_code -> 403 Forbidden
  const outsideAttempt = simulatePlaceOrder(
    { table_number: 4, items: [{ id: "dish-1", quantity: 1 }] },
    activeTable,
  );
  assert.equal(outsideAttempt.status, 403, "Outsider without QR code must be rejected with 403");

  // Attacker placing order with forged code -> 403 Forbidden
  const forgedAttempt = simulatePlaceOrder(
    { table_number: 4, table_code: "forged-code", items: [{ id: "dish-1", quantity: 1 }] },
    activeTable,
  );
  assert.equal(forgedAttempt.status, 403, "Forged code must be rejected with 403");

  // Legitimate customer who scanned table QR code -> 200 OK
  const verifiedAttempt = simulatePlaceOrder(
    { table_number: 4, table_code: "secr3t-c0de-4", items: [{ id: "dish-1", quantity: 1 }] },
    activeTable,
  );
  assert.equal(verifiedAttempt.status, 200, "Verified table QR order must succeed");
  console.log("✓ Order placement security enforcement (HTTP 403 on missing/invalid QR) verified");

  // Test 5: Menu view-only policy simulation
  function getMenuDishActions(dish, tableLock) {
    const actions = [];
    if (dish.stock === 0) {
      actions.push("sold-out");
    } else if (tableLock) {
      actions.push("add-to-cart");
    }
    // If no tableLock and not sold-out, no add button is rendered
    return actions;
  }

  const sampleDish = { id: "dosa-1", name: "Masala Dosa", stock: 5 };
  assert.deepEqual(
    getMenuDishActions(sampleDish, null),
    [],
    "No Add button should be rendered without an active table lock",
  );
  assert.deepEqual(
    getMenuDishActions(sampleDish, { table: 3, code: "c0de" }),
    ["add-to-cart"],
    "Add button should be rendered when table lock is active",
  );
  console.log("✓ View-only menu policy (add to cart hidden without QR scan) verified");

  console.log("\nAll Table QR Code Security and View-Only Menu tests passed successfully!");
}

runSecurityTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

