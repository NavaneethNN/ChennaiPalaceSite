import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/server/db";
import {
  createStaffSession,
  hash,
  loginLimit,
  passwordMatches,
  staff,
} from "@/lib/server/auth";
import { assert, body, failure, json, sameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    return json(await staff());
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = await body(request);
    assert(
      data.role === "admin" || data.role === "cashier",
      "Choose a login type.",
    );
    assert(
      typeof data.password === "string" && data.password.length <= 256,
      "Enter your password.",
    );
    const key = data.role === "admin" ? "admin" : `cashier:${data.pin}`;
    if (data.role === "cashier")
      assert(
        typeof data.pin === "string" &&
          /^\d{4}$/.test(data.pin) &&
          /^\d{4}$/.test(data.password),
        "PIN and password must each contain exactly four digits.",
      );
    assert(
      await loginLimit(key),
      "Too many login attempts. Try again in 15 minutes.",
      429,
    );
    if (data.role === "admin") {
      assert(
        process.env.SUPERADMIN_PASSWORD,
        "Super admin login is not configured.",
        503,
      );
      assert(
        timingSafeEqual(
          Buffer.from(hash(data.password)),
          Buffer.from(hash(process.env.SUPERADMIN_PASSWORD)),
        ),
        "Incorrect credentials.",
        401,
      );
      await createStaffSession({
        role: "admin",
        name: "Super admin",
        cashier_id: null,
      });
    } else {
      const { rows } = await db().query(
        "SELECT * FROM palace.cashiers WHERE pin=$1 AND active=true",
        [data.pin],
      );
      assert(
        rows[0] &&
          (await passwordMatches(data.password, rows[0].password_hash)),
        "Incorrect credentials.",
        401,
      );
      await createStaffSession({
        role: "cashier",
        name: rows[0].name,
        cashier_id: rows[0].id,
      });
    }
    await db().query("DELETE FROM palace.login_attempts WHERE key=$1", [key]);
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const jar = await cookies();
    const token = jar.get("palace_staff")?.value;
    if (token)
      await db().query(
        "DELETE FROM palace.staff_sessions WHERE token_hash=$1",
        [hash(token)],
      );
    jar.delete("palace_staff");
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
