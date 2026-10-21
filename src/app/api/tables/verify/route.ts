import { assert, failure, json } from "@/lib/server/http";
import { verifyTableCode } from "@/lib/server/tables";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tableParam = searchParams.get("table");
    const codeParam = searchParams.get("code");

    const tableNum = Number(tableParam);
    assert(
      Number.isInteger(tableNum) && tableNum >= 1 && tableNum <= 999,
      "Invalid table number.",
    );
    assert(
      typeof codeParam === "string" && codeParam.trim().length > 0,
      "Missing table QR code. Please scan the QR code located on your table.",
    );

    const result = await verifyTableCode(tableNum, codeParam);
    assert(result.valid, result.error || "Invalid or expired table QR code.", 403);

    return json({ ok: true, valid: true, table: tableNum });
  } catch (error) {
    return failure(error);
  }
}
