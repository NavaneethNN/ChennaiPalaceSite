import { db } from "@/lib/server/db";
import { staff } from "@/lib/server/auth";
import { assert, failure, uuid } from "@/lib/server/http";
import { kotPdf } from "@/lib/server/kot";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await staff();
    const { id } = await params;
    assert(uuid(id), "Invalid order.");
    const destination = new URL(request.url).searchParams.get("printer");
    assert(
      !destination || ["cashier", "kitchen"].includes(destination),
      "Invalid printer.",
    );
    const { rows } = await db().query(
      `SELECT o.*,s.table_number FROM palace.orders o JOIN palace.table_sessions s ON s.id=o.session_id WHERE o.id=$1 AND o.status='accepted'`,
      [id],
    );
    assert(rows[0], "Accepted order not found.", 404);
    const items = await db().query(
      "SELECT * FROM palace.order_items WHERE order_id=$1 ORDER BY id",
      [id],
    );
    assert(
      !destination || items.rows.some((i) => i.printer === destination),
      "No items for this printer.",
      404,
    );
    const pdf = await kotPdf(
      { ...rows[0], items: items.rows },
      destination || undefined,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="KOT-${rows[0].table_number}-${id.slice(0, 8)}${destination ? `-${destination}` : ""}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
