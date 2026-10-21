import { db } from "@/lib/server/db";
import { staff } from "@/lib/server/auth";
import { assert, failure, uuid } from "@/lib/server/http";
import { getPrinterSettings } from "@/lib/server/printers";
import { formatReceiptText } from "@/lib/server/receipt-text";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await staff();
    const { id } = await params;
    assert(uuid(id), "Invalid order.");
    const destination = (new URL(request.url).searchParams.get("printer") ||
      "kitchen") as "kitchen" | "cashier";
    assert(
      destination === "kitchen" || destination === "cashier",
      "Invalid printer destination.",
    );

    const { rows } = await db().query(
      `SELECT o.*,s.table_number FROM palace.orders o JOIN palace.table_sessions s ON s.id=o.session_id WHERE o.id=$1 AND o.status != 'rejected'`,
      [id],
    );
    assert(rows[0], "Order not found.", 404);

    const items = await db().query(
      "SELECT * FROM palace.order_items WHERE order_id=$1 ORDER BY id",
      [id],
    );

    const settings = await getPrinterSettings();
    const printerName =
      destination === "kitchen"
        ? settings.kitchen_printer
        : settings.cashier_printer;
    const paperSize =
      destination === "kitchen"
        ? settings.kitchen_paper_size
        : settings.cashier_paper_size;

    const text = formatReceiptText(
      {
        id: rows[0].id,
        table_number: rows[0].table_number,
        session_id: rows[0].session_id,
        decided_at: rows[0].decided_at || new Date().toISOString(),
        notes: rows[0].notes || "",
        items: items.rows,
      },
      destination,
      printerName,
      paperSize,
    );

    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
