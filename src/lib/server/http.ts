import "server-only";
import { NextResponse } from "next/server";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  assert(
    Number(request.headers.get("content-length") || 0) < 32768,
    "Request is too large.",
    413,
  );
  const raw = await request.text();
  assert(raw.length < 32768, "Request is too large.", 413);
  try {
    const data = JSON.parse(raw);
    assert(
      data && typeof data === "object" && !Array.isArray(data),
      "Invalid request.",
    );
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON.");
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  assert(
    !origin ||
      origin === new URL(request.url).origin ||
      origin === process.env.NEXT_PUBLIC_SITE_URL,
    "Invalid request origin.",
    403,
  );
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error(
    "Restaurant API failed:",
    error instanceof Error ? error.name : "unknown",
  );
  return NextResponse.json(
    {
      error:
        "Unable to complete this request. Please try again or contact the restaurant.",
    },
    { status: 500 },
  );
}
export function json(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
