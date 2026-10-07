import "server-only";
import { Client } from "pg";
import { db } from "./db";

// One listener per server process, shared by all connected staff browsers.
// NOTIFY is delivered after commit; the revision poll recovers missed events.
class LiveUpdates {
  listeners = new Set<() => void>();
  client: Client | null = null;
  timer: ReturnType<typeof setTimeout> | undefined;
  revision: string | undefined;
  running = false;
  connecting = false;

  emit = () => this.listeners.forEach((listener) => listener());

  async connect() {
    if (this.client || this.connecting || !process.env.DATABASE_URL_UNPOOLED)
      return;
    this.connecting = true;
    const client = new Client({
      connectionString: process.env.DATABASE_URL_UNPOOLED,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
    });
    const lost = () => {
      if (this.client === client) this.client = null;
      void client.end().catch(() => {});
    };
    client.on("error", lost);
    client.on("notification", this.emit);
    try {
      await client.connect();
      await client.query("LISTEN palace_changes");
      if (!this.listeners.size) await client.end();
      else this.client = client;
    } catch {
      await client.end().catch(() => {});
    } finally {
      this.connecting = false;
    }
  }

  poll = async () => {
    if (this.running) return;
    this.running = true;
    try {
      const { rows } = await db().query(
        "SELECT revision::text FROM palace.live_revision WHERE id=1",
      );
      if (this.revision !== rows[0].revision) {
        this.revision = rows[0].revision;
        this.emit();
      }
      void this.connect();
    } catch {
      // Browser heartbeat checks surface database failures; retry on the next tick.
    } finally {
      this.running = false;
      if (this.listeners.size)
        this.timer = setTimeout(this.poll, this.client ? 15000 : 1000);
    }
  };

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    if (this.listeners.size === 1) void this.poll();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        clearTimeout(this.timer);
        const client = this.client;
        this.client = null;
        void client?.end().catch(() => {});
      }
    };
  }
}
const shared = globalThis as unknown as { palaceLive?: LiveUpdates };
export const liveUpdates = (shared.palaceLive ??= new LiveUpdates());
