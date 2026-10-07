import "server-only";
import { db } from "./db";
import type { TableSession } from "../types";

export async function sessions(history = false): Promise<TableSession[]> {
  // One statement keeps the displayed total and order list on the same DB snapshot.
  const { rows } = await db().query(`
    SELECT s.*,
      COALESCE((
        SELECT sum(i.price_cents::bigint * i.quantity)
        FROM palace.orders o JOIN palace.order_items i ON i.order_id = o.id
        WHERE o.session_id = s.id AND o.status = 'accepted'
      ), 0)::text AS total_cents,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', o.id, 'session_id', o.session_id, 'status', o.status,
          'notes', o.notes, 'created_at', o.created_at, 'decided_at', o.decided_at,
          'items', COALESCE((
            SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id)
            FROM palace.order_items i WHERE i.order_id = o.id
          ), '[]'::jsonb)
        ) ORDER BY o.created_at)
        FROM palace.orders o WHERE o.session_id = s.id
      ), '[]'::jsonb) AS orders
    FROM palace.table_sessions s
    WHERE ${history ? "s.closed_at IS NOT NULL" : "s.closed_at IS NULL"}
    ORDER BY ${history ? "s.closed_at DESC" : "s.table_number"}
    LIMIT ${history ? 100 : 1000}
  `);
  return rows.map((s) => ({ ...s, total_cents: Number(s.total_cents) }));
}
