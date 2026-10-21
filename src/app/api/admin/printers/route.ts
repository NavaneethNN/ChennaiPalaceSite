import { staff } from "@/lib/server/auth";
import { assert, body, failure, json, sameOrigin } from "@/lib/server/http";
import {
  getPrinterSettings,
  getSystemPrinters,
  savePrinterSettings,
} from "@/lib/server/printers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await staff(true);
    const url = new URL(request.url);
    const settings = await getPrinterSettings();
    const queryBridgeHost =
      url.searchParams.get("bridge_host") || settings.bridge_host || "127.0.0.1";
    const detected = await getSystemPrinters(queryBridgeHost);

    return json({
      settings,
      system_printers: detected.printers,
      platform: detected.platform,
      source: detected.source,
      error: detected.error,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await staff(true);
    const data = await body(request);

    assert(
      typeof data.kitchen_printer === "string" &&
        data.kitchen_printer.length <= 120,
      "Kitchen printer name must be under 120 characters.",
    );
    assert(
      typeof data.cashier_printer === "string" &&
        data.cashier_printer.length <= 120,
      "Cashier printer name must be under 120 characters.",
    );

    const kitchenPaper =
      data.kitchen_paper_size === "58mm" ? "58mm" : "80mm";
    const cashierPaper =
      data.cashier_paper_size === "58mm" ? "58mm" : "80mm";
    const bridgeHost =
      typeof data.bridge_host === "string" && data.bridge_host.trim()
        ? data.bridge_host.trim()
        : "127.0.0.1";

    const saved = await savePrinterSettings(
      data.kitchen_printer,
      kitchenPaper,
      data.cashier_printer,
      cashierPaper,
      user.name,
      bridgeHost,
    );

    return json({ ok: true, settings: saved });
  } catch (error) {
    return failure(error);
  }
}

