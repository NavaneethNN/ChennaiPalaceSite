import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import pg from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in .env.local");
const client = new pg.Client({
  connectionTimeoutMillis: 15000,
  connectionString:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
});
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
  const { rows } = await client.query(
    "SELECT count(*)::int AS count FROM palace.menu_items",
  );
  if (rows[0].count === 0) {
    const menu = JSON.parse(
      await readFile(new URL("../src/lib/menu.json", import.meta.url), "utf8"),
    );
    let sort = 0;
    for (const group of menu)
      for (const item of group.items) {
        const price = Number(item.price.replace(/[^\d.]/g, ""));
        if (!Number.isFinite(price))
          throw new Error(`Invalid price for ${item.name}`);
        await client.query(
          "INSERT INTO palace.menu_items(id,category,name,description,price_cents,sort_order) VALUES($1,$2,$3,$4,$5,$6)",
          [
            randomUUID(),
            group.title,
            item.name,
            item.description,
            Math.round(price * 100),
            sort++,
          ],
        );
      }
    console.log(
      `Seeded ${sort} existing menu items. All default to kitchen; choose destinations in Admin.`,
    );
  }
  await client.query("COMMIT");
  console.log("Neon restaurant schema is ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Database setup failed:",
    error.code || error.name,
    error.message?.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
