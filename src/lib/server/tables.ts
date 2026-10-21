import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/server/db";
import type { RestaurantTable } from "@/lib/types";

let schemaEnsured = false;

export function generateTableSecret(): string {
  return randomBytes(16).toString("hex");
}

export async function ensureTableSchema() {
  if (schemaEnsured) return;
  try {
    await db().query(`
      ALTER TABLE palace.restaurant_tables ADD COLUMN IF NOT EXISTS qr_code text;
      UPDATE palace.restaurant_tables
      SET qr_code = replace(gen_random_uuid()::text, '-', '')
      WHERE qr_code IS NULL OR qr_code = '';
    `);
    schemaEnsured = true;
  } catch {
    // If schema query fails, subsequent queries will report
  }
}

export async function getAllTables(): Promise<RestaurantTable[]> {
  await ensureTableSchema();
  const { rows } = await db().query<RestaurantTable>(
    `SELECT number, active, COALESCE(qr_code, '') AS qr_code
     FROM palace.restaurant_tables
     ORDER BY number`,
  );
  return rows;
}

export async function verifyTableCode(
  tableNumber: number,
  code?: string | null,
): Promise<{ valid: boolean; active: boolean; error?: string }> {
  await ensureTableSchema();
  if (!code || typeof code !== "string" || !code.trim()) {
    return { valid: false, active: false, error: "Missing table QR code." };
  }

  const { rows } = await db().query<{ active: boolean; qr_code: string }>(
    `SELECT active, qr_code
     FROM palace.restaurant_tables
     WHERE number = $1`,
    [tableNumber],
  );

  if (!rows[0]) {
    return { valid: false, active: false, error: `Table ${tableNumber} does not exist.` };
  }

  if (!rows[0].active) {
    return {
      valid: false,
      active: false,
      error: `Table ${tableNumber} is currently unavailable. Please ask staff.`,
    };
  }

  const matches = rows[0].qr_code.toLowerCase().trim() === code.toLowerCase().trim();
  if (!matches) {
    return {
      valid: false,
      active: true,
      error: "Invalid or expired table QR code. Please scan the QR code located on your table.",
    };
  }

  return { valid: true, active: true };
}

export async function regenerateTableQrCode(tableNumber: number): Promise<string> {
  await ensureTableSchema();
  const newSecret = generateTableSecret();
  await db().query(
    `UPDATE palace.restaurant_tables
     SET qr_code = $1
     WHERE number = $2`,
    [newSecret, tableNumber],
  );
  return newSecret;
}

export async function saveTable(tableNumber: number, active: boolean): Promise<RestaurantTable> {
  await ensureTableSchema();
  const newSecret = generateTableSecret();
  const { rows } = await db().query<RestaurantTable>(
    `INSERT INTO palace.restaurant_tables(number, active, qr_code)
     VALUES($1, $2, $3)
     ON CONFLICT(number) DO UPDATE
       SET active = EXCLUDED.active,
           qr_code = COALESCE(palace.restaurant_tables.qr_code, EXCLUDED.qr_code)
     RETURNING number, active, qr_code`,
    [tableNumber, active, newSecret],
  );
  return rows[0];
}

