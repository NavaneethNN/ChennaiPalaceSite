import { transaction } from "@/lib/server/db";
import { staff } from "@/lib/server/auth";
import {
  assert,
  body,
  failure,
  json,
  sameOrigin,
  uuid,
} from "@/lib/server/http";
import { sessions } from "@/lib/server/operations";
import type { OrderItem } from "@/lib/types";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await staff();
    return json(
      await sessions(new URL(request.url).searchParams.get("history") === "1"),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await staff();
    const data = await body(request);
    assert(uuid(data.id), "Invalid reference.");
    assert(
      ["accept", "reject", "close"].includes(String(data.action)),
      "Invalid action.",
    );
    const result = await transaction(async (client) => {
      const lookup =
        data.action === "close"
          ? await client.query(
              "SELECT table_number,id FROM palace.table_sessions WHERE id=$1",
              [data.id],
            )
          : await client.query(
              "SELECT s.table_number,s.id FROM palace.orders o JOIN palace.table_sessions s ON s.id=o.session_id WHERE o.id=$1",
              [data.id],
            );
      assert(lookup.rows[0], "Order or session not found.", 404);
      await client.query("SELECT pg_advisory_xact_lock(31001,$1)", [
        lookup.rows[0].table_number,
      ]);
      const { rows: s } = await client.query(
        "SELECT * FROM palace.table_sessions WHERE id=$1 FOR UPDATE",
        [lookup.rows[0].id],
      );
      assert(!s[0].closed_at, "This table session is already closed.", 409);
      if (data.action === "close") {
        const pending = await client.query(
          "SELECT id FROM palace.orders WHERE session_id=$1 AND status='pending'",
          [data.id],
        );
        assert(
          !pending.rows.length,
          "Accept or reject all pending orders before closing the session.",
          409,
        );
        const bill = await client.query(
          `SELECT (SELECT count(*)::int FROM palace.orders WHERE session_id=$1) AS order_count,
          COALESCE(sum(i.price_cents::bigint*i.quantity),0)::text AS total
          FROM palace.orders o JOIN palace.order_items i ON i.order_id=o.id
          WHERE o.session_id=$1 AND o.status='accepted'`,
          [data.id],
        );
        assert(
          data.expected_total === Number(bill.rows[0].total) &&
            data.expected_order_count === bill.rows[0].order_count,
          "This table changed. Review its latest orders and total before closing.",
          409,
        );
        await client.query(
          "UPDATE palace.table_sessions SET closed_at=now(),closed_by=$2 WHERE id=$1",
          [data.id, user.name],
        );
        return { ok: true };
      }
      const { rows: o } = await client.query(
        "SELECT * FROM palace.orders WHERE id=$1 FOR UPDATE",
        [data.id],
      );
      if (o[0].status === "accepted" && data.action === "accept")
        return { ok: true, kot_url: `/api/kot/${data.id}` };
      assert(
        o[0].status === "pending",
        "This order has already been processed.",
        409,
      );
      if (data.action === "accept") {
        const { rows: items } = await client.query<OrderItem>(
          "SELECT * FROM palace.order_items WHERE order_id=$1 ORDER BY menu_item_id",
          [data.id],
        );
        const { rows: menu } = await client.query(
          "SELECT * FROM palace.menu_items WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
          [items.map((i) => i.menu_item_id)],
        );
        for (const item of items) {
          const dish = menu.find((d) => d.id === item.menu_item_id);
          assert(
            dish &&
              dish.active &&
              (dish.stock === null || dish.stock >= item.quantity),
            `${item.name} is unavailable. Update stock or reject this order.`,
            409,
          );
        }
        await client.query(
          `UPDATE palace.menu_items m SET stock=m.stock-i.quantity
           FROM palace.order_items i
           WHERE i.order_id=$1 AND m.id=i.menu_item_id AND m.stock IS NOT NULL`,
          [data.id],
        );
      }
      await client.query(
        "UPDATE palace.orders SET status=$2,decided_at=now(),decided_by=$3 WHERE id=$1",
        [
          data.id,
          data.action === "accept" ? "accepted" : "rejected",
          user.name,
        ],
      );
      return {
        ok: true,
        ...(data.action === "accept" ? { kot_url: `/api/kot/${data.id}` } : {}),
      };
    });
    return json(result);
  } catch (error) {
    return failure(error);
  }
}
