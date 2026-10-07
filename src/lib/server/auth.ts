import "server-only";
import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const deriveKey = promisify(scrypt);
import { cookies } from "next/headers";
import { db, transaction } from "./db";
import { assert } from "./http";
import type { Staff } from "../types";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${((await deriveKey(value, salt, 64)) as Buffer).toString("hex")}`;
}
export async function passwordMatches(value: string, stored: string) {
  const [salt, digest] = stored.split(":");
  const actual = (await deriveKey(value, salt, 64)) as Buffer;
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function staff(adminOnly = false): Promise<Staff> {
  const token = (await cookies()).get("palace_staff")?.value;
  assert(token, "Please sign in.", 401);
  const { rows } = await db().query(
    `SELECT s.role,s.cashier_id,COALESCE(c.name,'Super admin') AS name FROM palace.staff_sessions s LEFT JOIN palace.cashiers c ON c.id=s.cashier_id WHERE s.token_hash=$1 AND s.expires_at>now() AND (s.role='admin' OR c.active=true)`,
    [hash(token)],
  );
  assert(rows[0], "Your session has expired. Please sign in.", 401);
  assert(
    !adminOnly || rows[0].role === "admin",
    "Super admin access is required.",
    403,
  );
  return rows[0];
}
export async function loginLimit(key: string) {
  return transaction(async (client) => {
    await client.query(
      "INSERT INTO palace.login_attempts(key) VALUES($1) ON CONFLICT DO NOTHING",
      [key],
    );
    const { rows } = await client.query(
      "SELECT * FROM palace.login_attempts WHERE key=$1 FOR UPDATE",
      [key],
    );
    const reset =
      Date.now() - new Date(rows[0].window_start).getTime() >= 15 * 60 * 1000;
    if (!reset && rows[0].attempts >= 10) return false;
    await client.query(
      `UPDATE palace.login_attempts SET attempts=CASE WHEN $2 THEN 1 ELSE attempts+1 END, window_start=CASE WHEN $2 THEN now() ELSE window_start END WHERE key=$1`,
      [key, reset],
    );
    return true;
  });
}
export async function createStaffSession(user: Staff) {
  const token = randomBytes(32).toString("hex");
  await db().query(
    "INSERT INTO palace.staff_sessions(token_hash,role,cashier_id,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
    [hash(token), user.role, user.cashier_id],
  );
  (await cookies()).set("palace_staff", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 43200,
  });
}
