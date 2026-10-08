import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/server/db";
import { passwordHash, staff } from "@/lib/server/auth";
import {
  assert,
  body,
  failure,
  json,
  sameOrigin,
  uuid,
} from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    await staff(true);
    const [menu, cashiers, tables] = await Promise.all([
      db().query("SELECT * FROM palace.menu_items ORDER BY sort_order,name"),
      db().query(
        "SELECT id,name,pin,active FROM palace.cashiers ORDER BY created_at",
      ),
      db().query(
        "SELECT number,active FROM palace.restaurant_tables ORDER BY number",
      ),
    ]);
    return json({
      menu: menu.rows,
      cashiers: cashiers.rows,
      tables: tables.rows,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await staff(true);
    const data = await body(request);
    if (data.kind === "menu") {
      assert(data.id === undefined || uuid(data.id), "Invalid menu item.");
      assert(
        typeof data.name === "string" &&
          (data.name as string).trim().length > 0 &&
          data.name.length <= 120,
        "Enter a dish name (up to 120 characters).",
      );
      assert(
        typeof data.category === "string" &&
          data.category.trim().length > 0 &&
          data.category.length <= 80,
        "Enter a category.",
      );
      assert(
        typeof data.description === "string" && data.description.length <= 500,
        "Description must be under 500 characters.",
      );
      assert(
        Number.isInteger(data.price_cents) &&
          Number(data.price_cents) >= 0 &&
          Number(data.price_cents) <= 1000000,
        "Enter a valid price.",
      );
      assert(
        data.printer === "kitchen" || data.printer === "cashier",
        "Choose a printer destination.",
      );
      assert(
        data.stock === null ||
          (Number.isInteger(data.stock) &&
            Number(data.stock) >= 0 &&
            Number(data.stock) <= 1000000),
        "Enter valid stock or leave it unlimited.",
      );
      assert(typeof data.active === "boolean", "Invalid availability.");
      const params = [
        (data.name as string).trim(),
        data.category.trim(),
        data.description,
        data.price_cents,
        data.printer,
        data.stock,
        data.active,
      ];
      if (data.id) {
        assert(
          Number.isInteger(data.version),
          "Reload this dish before saving.",
          409,
        );
        const result = await db().query(
          "UPDATE palace.menu_items SET name=$1,category=$2,description=$3,price_cents=$4,printer=$5,stock=$6,active=$7 WHERE id=$8 AND version=$9 RETURNING id",
          [...params, data.id, data.version],
        );
        assert(
          result.rows.length,
          "This dish or its stock changed. Close the editor and reopen it before saving.",
          409,
        );
      } else
        await db().query(
          "INSERT INTO palace.menu_items(name,category,description,price_cents,printer,stock,active,id,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,(SELECT COALESCE(max(sort_order),0)+1 FROM palace.menu_items))",
          [...params, randomUUID()],
        );
    } else if (data.kind === "table") {
      assert(
        Number.isInteger(data.number) &&
          Number(data.number) >= 1 &&
          Number(data.number) <= 999,
        "Choose a table number from 1 to 999.",
      );
      assert(typeof data.active === "boolean", "Invalid table status.");
      await db().query(
        `INSERT INTO palace.restaurant_tables(number,active) VALUES($1,$2)
         ON CONFLICT(number) DO UPDATE SET active=EXCLUDED.active`,
        [data.number, data.active],
      );
    } else if (data.kind === "cashier") {
      assert(data.id === undefined || uuid(data.id), "Invalid cashier.");
      assert(
        typeof data.name === "string" &&
          (data.name as string).trim().length > 0 &&
          data.name.length <= 80,
        "Enter a cashier name.",
      );
      assert(
        typeof data.pin === "string" && /^\d{4}$/.test(data.pin),
        "PIN must contain exactly four digits.",
      );
      assert(typeof data.active === "boolean", "Invalid cashier status.");
      assert(
        typeof data.password === "string" &&
          (/^\d{4}$/.test(data.password) || (data.id && data.password === "")),
        "Password must contain exactly four digits.",
      );
      await transaction(async (client) => {
        if (data.id) {
          const result = await client.query(
            "UPDATE palace.cashiers SET name=$1,pin=$2,active=$3,password_hash=COALESCE($4,password_hash) WHERE id=$5 RETURNING id",
            [
              (data.name as string).trim(),
              data.pin,
              data.active,
              data.password
                ? await passwordHash(data.password as string)
                : null,
              data.id,
            ],
          );
          assert(result.rows.length, "Cashier not found.", 404);
          if (!data.active || data.password)
            await client.query(
              "DELETE FROM palace.staff_sessions WHERE cashier_id=$1",
              [data.id],
            );
        } else
          await client.query(
            "INSERT INTO palace.cashiers(id,name,pin,password_hash,active) VALUES($1,$2,$3,$4,$5)",
            [
              randomUUID(),
              (data.name as string).trim(),
              data.pin,
              await passwordHash(data.password as string),
              data.active,
            ],
          );
      });
    } else assert(false, "Invalid operation.");
    return json({ ok: true });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return jsonError("This PIN is already assigned to another cashier.");
    return failure(error);
  }
}
function jsonError(message: string) {
  return Response.json({ error: message }, { status: 409 });
}
