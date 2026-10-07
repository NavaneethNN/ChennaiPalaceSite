import { staff } from "@/lib/server/auth";
import { failure } from "@/lib/server/http";
import { liveUpdates } from "@/lib/server/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    await staff();
    let stop = () => {};
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let stopped = false;
        let checking = false;
        const send = (event: string) => {
          if (!stopped)
            controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
        };
        // Events contain no order/customer data. Every data fetch authorizes again.
        const unsubscribe = liveUpdates.subscribe(() => send("change"));
        stop = () => {
          if (stopped) return;
          stopped = true;
          clearInterval(heartbeat);
          clearTimeout(expiry);
          unsubscribe();
          request.signal.removeEventListener("abort", stop);
          try {
            controller.close();
          } catch {
            /* Stream already cancelled. */
          }
        };
        const heartbeat = setInterval(async () => {
          if (checking) return;
          checking = true;
          try {
            await staff();
            send("heartbeat");
          } catch {
            send("expired");
            stop();
          } finally {
            checking = false;
          }
        }, 15000);
        // Reconnect within typical hosting execution limits and reauthorize.
        const expiry = setTimeout(stop, 55000);
        request.signal.addEventListener("abort", stop, { once: true });
        send("ready");
        if (request.signal.aborted) stop();
      },
      cancel() {
        stop();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "private, no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
