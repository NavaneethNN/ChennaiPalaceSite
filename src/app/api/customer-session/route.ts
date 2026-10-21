import { db } from "@/lib/server/db";
import { hash } from "@/lib/server/auth";
import { assert, failure, json, uuid } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("x-customer-token");
    const table = Number(new URL(request.url).searchParams.get("table"));
    assert(uuid(token), "Invalid customer session.", 401);
    assert(
      Number.isInteger(table) && table > 0 && table <= 999,
      "Invalid table.",
    );
    const { rows } = await db().query(
      `WITH customer_session AS (
         SELECT id,table_number,closed_at FROM palace.table_sessions
         WHERE customer_token_hash=$1 AND table_number=$2
         ORDER BY opened_at DESC LIMIT 1
       )
       SELECT s.id AS session_id,s.table_number,s.closed_at,
              o.id,o.status,o.created_at,
              COALESCE(lines.items,'[]'::jsonb) AS items,
              COALESCE(lines.total_cents,0)::text AS total_cents
       FROM customer_session s
       LEFT JOIN palace.orders o ON o.session_id=s.id AND s.closed_at IS NULL
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
                  'name',i.name,'quantity',i.quantity,'price_cents',i.price_cents
                ) ORDER BY i.id) AS items,
                sum(i.price_cents::bigint*i.quantity) AS total_cents
         FROM palace.order_items i WHERE i.order_id=o.id
       ) lines ON true
       ORDER BY o.created_at,o.id`,
      [hash(token), table],
    );
    assert(rows[0], "Customer session not found.", 404);
    return json({
      id: rows[0].session_id,
      table: rows[0].table_number,
      closed_at: rows[0].closed_at,
      orders: rows
        .filter((row) => row.id)
        .map((row) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          items: row.items,
          total_cents: Number(row.total_cents),
        })),
    });
  } catch (error) {
    return failure(error);
  }
}
