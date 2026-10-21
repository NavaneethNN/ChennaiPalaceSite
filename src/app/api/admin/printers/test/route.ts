import { staff } from "@/lib/server/auth";
import { assert, failure } from "@/lib/server/http";
import { kotPdf } from "@/lib/server/kot";
import { getPrinterSettings } from "@/lib/server/printers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await staff(); // Authenticated staff can test print
    const url = new URL(request.url);
    const destination = url.searchParams.get("destination") || "kitchen";
    assert(
      destination === "kitchen" || destination === "cashier",
      "Invalid printer destination.",
    );

    const settings = await getPrinterSettings();
    const assignedName =
      destination === "kitchen"
        ? settings.kitchen_printer || "Default Kitchen Printer"
        : settings.cashier_printer || "Default Cashier Printer";

    const testTicket = {
      id: "TESTPRN1",
      table_number: 99,
      session_id: "TESTSESS",
      notes: `TEST PRINT for ${destination.toUpperCase()} printer [${assignedName}]`,
      decided_at: new Date().toISOString(),
      items: [
        {
          id: "test-item-1",
          menu_item_id: "00000000-0000-0000-0000-000000000001",
          name:
            destination === "kitchen"
              ? "Masala Dosa (Kitchen Test)"
              : "South Indian Filter Coffee (Cashier Test)",
          price_cents: 1250,
          quantity: 1,
          printer: destination as "kitchen" | "cashier",
        },
      ],
    };

    const paperSize =
      destination === "kitchen"
        ? settings.kitchen_paper_size
        : settings.cashier_paper_size;

    const pdf = await kotPdf(testTicket, destination, assignedName, paperSize);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="TEST-${destination.toUpperCase()}-KOT.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

