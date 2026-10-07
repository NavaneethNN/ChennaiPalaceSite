import { db } from "@/lib/server/db";
import { failure, json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { rows } = await db().query(
      "SELECT id,category,name,description,price_cents,stock,active,sort_order FROM palace.menu_items WHERE active=true ORDER BY sort_order,name",
    );
    return json(rows);
  } catch (error) {
    return failure(error);
  }
}
