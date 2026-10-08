import { db } from "@/lib/server/db";
import { hash } from "@/lib/server/auth";
import { failure, json, uuid } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const token = request.headers.get("x-customer-token");
    const tokenHash = uuid(token) ? hash(token) : null;
    const { rows } = await db().query(
      `SELECT t.number,
        CASE WHEN s.id IS NULL THEN 'available'
             WHEN s.customer_token_hash=$1 THEN 'yours'
             ELSE 'occupied' END AS status
       FROM palace.restaurant_tables t
       LEFT JOIN palace.table_sessions s ON s.table_number=t.number AND s.closed_at IS NULL
       WHERE t.active=true ORDER BY t.number`,
      [tokenHash],
    );
    return json(rows);
  } catch (error) {
    return failure(error);
  }
}
