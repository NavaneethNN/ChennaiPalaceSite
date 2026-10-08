import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/server/db";
import { hash } from "@/lib/server/auth";
import {
  assert,
  body,
  failure,
  json,
  sameOrigin,
  uuid,
} from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = await body(request);
    assert(
      Number.isInteger(data.table_number) &&
        Number(data.table_number) > 0 &&
        Number(data.table_number) <= 999,
      "Enter a table number from 1 to 999.",
    );
    assert(
      uuid(data.request_key) && uuid(data.tracking_token),
      "Invalid order reference.",
    );
    assert(
      data.customer_token === undefined || uuid(data.customer_token),
      "Invalid customer session.",
    );
    assert(
      Array.isArray(data.items) &&
        data.items.length > 0 &&
        data.items.length <= 50,
      "Choose between 1 and 50 dishes.",
    );
    const items = data.items as { id: string; quantity: number }[];
    assert(
      items.every(
        (i) =>
          i &&
          uuid(i.id) &&
          Number.isInteger(i.quantity) &&
          i.quantity >= 1 &&
          i.quantity <= 50,
      ),
      "Invalid item quantity.",
    );
    assert(
      new Set(items.map((i) => i.id)).size === items.length,
      "Duplicate menu items.",
    );
    assert(
      data.notes === undefined ||
        (typeof data.notes === "string" && data.notes.length <= 500),
      "Notes must be under 500 characters.",
    );
    const result = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(31001,$1)", [
        data.table_number,
      ]);
      const existing = await client.query(
        `SELECT o.id,o.tracking_hash,s.table_number FROM palace.orders o
         JOIN palace.table_sessions s ON s.id=o.session_id WHERE o.request_key=$1`,
        [data.request_key],
      );
      if (existing.rows[0]) {
        assert(
          existing.rows[0].tracking_hash ===
            hash(data.tracking_token as string),
          "Order reference already used.",
          409,
        );
        assert(
          existing.rows[0].table_number === data.table_number,
          "Order reference already used for another table.",
          409,
        );
        return { id: existing.rows[0].id };
      }
      const configured = await client.query(
        "SELECT active FROM palace.restaurant_tables WHERE number=$1 FOR SHARE",
        [data.table_number],
      );
      assert(
        configured.rows[0]?.active,
        "This table is not available. Please choose another table or ask the cashier.",
        409,
      );
      const { rows: sessions } = await client.query(
        "SELECT id,customer_token_hash FROM palace.table_sessions WHERE table_number=$1 AND closed_at IS NULL",
        [data.table_number],
      );
      assert(
        !sessions[0] ||
          (data.customer_token &&
            sessions[0].customer_token_hash ===
              hash(data.customer_token as string)),
        "This table is already in use. Please choose an available table or speak to the cashier.",
        409,
      );
      const { rows: menu } = await client.query(
        "SELECT * FROM palace.menu_items WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE",
        [items.map((i) => i.id)],
      );
      assert(menu.length === items.length, "Some dishes no longer exist.", 409);
      for (const item of items) {
        const dish = menu.find((d) => d.id === item.id);
        assert(
          dish.active && (dish.stock === null || dish.stock >= item.quantity),
          `${dish.name} is unavailable in this quantity. Please update your order.`,
          409,
        );
      }
      const pending = await client.query(
        `SELECT count(*)::int AS count FROM palace.orders o JOIN palace.table_sessions s ON s.id=o.session_id WHERE s.table_number=$1 AND s.closed_at IS NULL AND o.status='pending'`,
        [data.table_number],
      );
      assert(
        pending.rows[0].count < 10,
        "This table has too many pending orders. Please speak to the cashier.",
        429,
      );
      const sessionId = sessions[0]?.id || randomUUID();
      if (!sessions[0])
        await client.query(
          "INSERT INTO palace.table_sessions(id,table_number,customer_token_hash) VALUES($1,$2,$3)",
          [sessionId, data.table_number, hash(data.tracking_token as string)],
        );
      const id = randomUUID();
      await client.query(
        "INSERT INTO palace.orders(id,session_id,request_key,tracking_hash,notes) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          sessionId,
          data.request_key,
          hash(data.tracking_token as string),
          data.notes || "",
        ],
      );
      await client.query(
        `INSERT INTO palace.order_items(id,order_id,menu_item_id,name,price_cents,quantity,printer)
        SELECT i.id,$1,i.menu_item_id,i.name,i.price_cents,i.quantity,i.printer
        FROM jsonb_to_recordset($2::jsonb) AS i(id uuid,menu_item_id uuid,name text,price_cents integer,quantity integer,printer text)`,
        [
          id,
          JSON.stringify(
            items.map((item) => {
              const dish = menu.find((d) => d.id === item.id);
              return {
                id: randomUUID(),
                menu_item_id: item.id,
                name: dish.name,
                price_cents: dish.price_cents,
                quantity: item.quantity,
                printer: dish.printer,
              };
            }),
          ),
        ],
      );
      return { id };
    });
    return json(result);
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const token = url.searchParams.get("token");
    assert(uuid(id) && uuid(token), "Invalid order reference.");
    const { rows } = await db().query(
      `SELECT o.id,o.status,o.created_at,s.table_number,s.closed_at,
        COALESCE(lines.items,'[]'::jsonb) AS items,
        COALESCE(lines.total_cents,0)::text AS total_cents
       FROM palace.orders o
       JOIN palace.table_sessions s ON s.id=o.session_id
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object('name',i.name,'quantity',i.quantity,'price_cents',i.price_cents) ORDER BY i.id) AS items,
                sum(i.price_cents::bigint*i.quantity) AS total_cents
         FROM palace.order_items i WHERE i.order_id=o.id
       ) lines ON true
       WHERE o.id=$1 AND o.tracking_hash=$2`,
      [id, hash(token)],
    );
    assert(rows[0], "Order not found.", 404);
    return json({ ...rows[0], total_cents: Number(rows[0].total_cents) });
  } catch (error) {
    return failure(error);
  }
}
