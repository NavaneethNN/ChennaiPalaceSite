import "server-only";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { db } from "@/lib/server/db";
import type { DetectedPrinter, PaperSize, PrinterSettings } from "../types";

const execAsync = promisify(exec);

let tableEnsured = false;

export function inferPaperSize(printerName?: string): PaperSize {
  if (!printerName) return "80mm";
  const lower = printerName.toLowerCase();
  if (
    lower.includes("58") ||
    lower.includes("2inch") ||
    lower.includes("2-inch") ||
    lower.includes("58mm")
  ) {
    return "58mm";
  }
  return "80mm";
}

async function ensureTable() {
  if (tableEnsured) return;
  try {
    await db().query(`
      CREATE TABLE IF NOT EXISTS palace.printer_settings (
        id integer PRIMARY KEY CHECK (id = 1),
        kitchen_printer text NOT NULL DEFAULT '',
        kitchen_paper_size text NOT NULL DEFAULT '80mm',
        cashier_printer text NOT NULL DEFAULT '',
        cashier_paper_size text NOT NULL DEFAULT '80mm',
        bridge_host text NOT NULL DEFAULT '127.0.0.1',
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by text
      );
      ALTER TABLE palace.printer_settings ADD COLUMN IF NOT EXISTS kitchen_paper_size text NOT NULL DEFAULT '80mm';
      ALTER TABLE palace.printer_settings ADD COLUMN IF NOT EXISTS cashier_paper_size text NOT NULL DEFAULT '80mm';
      ALTER TABLE palace.printer_settings ADD COLUMN IF NOT EXISTS bridge_host text NOT NULL DEFAULT '127.0.0.1';
      INSERT INTO palace.printer_settings (id, kitchen_printer, kitchen_paper_size, cashier_printer, cashier_paper_size, bridge_host)
      VALUES (1, '', '80mm', '', '80mm', '127.0.0.1')
      ON CONFLICT (id) DO NOTHING;
    `);
    tableEnsured = true;
  } catch {
    // If permission or pool issue occurs, caller queries will report
  }
}

export async function getPrinterSettings(): Promise<PrinterSettings> {
  await ensureTable();
  try {
    const { rows } = await db().query<PrinterSettings>(
      `SELECT kitchen_printer,
              COALESCE(kitchen_paper_size, '80mm') AS kitchen_paper_size,
              cashier_printer,
              COALESCE(cashier_paper_size, '80mm') AS cashier_paper_size,
              COALESCE(bridge_host, '127.0.0.1') AS bridge_host,
              updated_at,
              updated_by
       FROM palace.printer_settings WHERE id = 1`,
    );
    if (rows[0]) {
      return {
        kitchen_printer: rows[0].kitchen_printer || "",
        kitchen_paper_size: rows[0].kitchen_paper_size === "58mm" ? "58mm" : "80mm",
        cashier_printer: rows[0].cashier_printer || "",
        cashier_paper_size: rows[0].cashier_paper_size === "58mm" ? "58mm" : "80mm",
        bridge_host: rows[0].bridge_host || "127.0.0.1",
        updated_at: rows[0].updated_at,
        updated_by: rows[0].updated_by,
      };
    }
  } catch {
    // Fallback if table query fails
  }
  return {
    kitchen_printer: "",
    kitchen_paper_size: "80mm",
    cashier_printer: "",
    cashier_paper_size: "80mm",
    bridge_host: "127.0.0.1",
  };
}

export async function savePrinterSettings(
  kitchenPrinter: string,
  kitchenPaperSize: PaperSize,
  cashierPrinter: string,
  cashierPaperSize: PaperSize,
  updatedBy: string,
  bridgeHost: string = "127.0.0.1",
): Promise<PrinterSettings> {
  await ensureTable();
  const validKitchenPaper: PaperSize =
    kitchenPaperSize === "58mm" ? "58mm" : "80mm";
  const validCashierPaper: PaperSize =
    cashierPaperSize === "58mm" ? "58mm" : "80mm";
  const cleanBridgeHost = bridgeHost.trim() || "127.0.0.1";

  const { rows } = await db().query<PrinterSettings>(
    `INSERT INTO palace.printer_settings(
       id, kitchen_printer, kitchen_paper_size, cashier_printer, cashier_paper_size, bridge_host, updated_at, updated_by
     )
     VALUES(1, $1, $2, $3, $4, $5, now(), $6)
     ON CONFLICT(id) DO UPDATE SET
       kitchen_printer = EXCLUDED.kitchen_printer,
       kitchen_paper_size = EXCLUDED.kitchen_paper_size,
       cashier_printer = EXCLUDED.cashier_printer,
       cashier_paper_size = EXCLUDED.cashier_paper_size,
       bridge_host = EXCLUDED.bridge_host,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by
     RETURNING kitchen_printer, kitchen_paper_size, cashier_printer, cashier_paper_size, bridge_host, updated_at, updated_by`,
    [
      kitchenPrinter.trim(),
      validKitchenPaper,
      cashierPrinter.trim(),
      validCashierPaper,
      cleanBridgeHost,
      updatedBy,
    ],
  );
  return (
    rows[0] || {
      kitchen_printer: kitchenPrinter,
      kitchen_paper_size: validKitchenPaper,
      cashier_printer: cashierPrinter,
      cashier_paper_size: validCashierPaper,
      bridge_host: cleanBridgeHost,
    }
  );
}

export async function getSystemPrinters(bridgeHost?: string): Promise<{
  printers: DetectedPrinter[];
  platform: string;
  source: string;
  error?: string;
}> {
  // If a Windows Bridge host IP/name is provided (e.g. 192.168.1.50 or 127.0.0.1),
  // attempt to query the Windows Printer Bridge over HTTP first.
  const host = bridgeHost?.trim();
  if (host) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`http://${host}:18080/printers`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : [raw];
        const printers: DetectedPrinter[] = list
          .filter((item) => item && (item.Name || item.name))
          .map((item) => ({
            name: String(item.Name || item.name).trim(),
            is_default: Boolean(item.Default ?? item.is_default),
            port: item.PortName || item.port || undefined,
          }))
          .filter((p) => p.name.length > 0);
        if (printers.length > 0) {
          return {
            printers,
            platform: "win32-bridge",
            source: `Windows bridge at ${host}:18080`,
          };
        }
      }
    } catch {
      // Bridge not reachable at this host; proceed to host OS check
    }
  }

  const platform = process.platform;

  if (platform === "win32") {
    // Attempt 1: Modern Windows PowerShell with Get-CimInstance
    try {
      const ps = `Get-CimInstance -ClassName Win32_Printer | Select-Object Name, Default, PortName | ConvertTo-Json -Compress`;
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`,
        { timeout: 6000 },
      );
      const parsed = JSON.parse(stdout.trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const printers: DetectedPrinter[] = list
        .filter((item) => item && (item.Name || item.name))
        .map((item) => ({
          name: String(item.Name || item.name).trim(),
          is_default: Boolean(item.Default ?? item.is_default),
          port: item.PortName || item.port || undefined,
        }));
      return { printers, platform, source: "powershell-cim" };
    } catch {
      // Attempt 2: PowerShell Get-Printer
      try {
        const ps = `Get-Printer | Select-Object Name, PortName | ConvertTo-Json -Compress`;
        const { stdout } = await execAsync(
          `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`,
          { timeout: 6000 },
        );
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const printers: DetectedPrinter[] = list
          .filter((item) => item && (item.Name || item.name))
          .map((item) => ({
            name: String(item.Name || item.name).trim(),
            port: item.PortName || item.port || undefined,
          }));
        return { printers, platform, source: "powershell-get-printer" };
      } catch {
        // Attempt 3: wmic fallback
        try {
          const { stdout } = await execAsync("wmic printer get name /format:list", {
            timeout: 5000,
          });
          const printers: DetectedPrinter[] = stdout
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.toLowerCase().startsWith("name="))
            .map((line) => ({ name: line.slice(5).trim() }))
            .filter((p) => p.name.length > 0);
          return { printers, platform, source: "wmic" };
        } catch (err) {
          return {
            printers: [],
            platform,
            source: "win32-failed",
            error: (err as Error).message,
          };
        }
      }
    }
  }

  // macOS (for development environments)
  if (platform === "darwin") {
    try {
      const { stdout } = await execAsync("lpstat -p", { timeout: 3000 });
      const printers: DetectedPrinter[] = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("printer "))
        .map((line) => {
          const parts = line.split(/\s+/);
          return { name: parts[1] || "" };
        })
        .filter((p) => p.name.length > 0);
      return { printers, platform, source: "lpstat" };
    } catch {
      return { printers: [], platform, source: "darwin-none" };
    }
  }

  // Linux (for Linux servers/development)
  if (platform === "linux") {
    try {
      const { stdout } = await execAsync(
        "lpstat -e 2>/dev/null || lpstat -a 2>/dev/null || true",
        { timeout: 3000 },
      );
      const printers: DetectedPrinter[] = stdout
        .split("\n")
        .map((line) => line.trim().split(/\s+/)[0])
        .filter(Boolean)
        .map((name) => ({ name }));
      return { printers, platform, source: "linux-lpstat" };
    } catch {
      return { printers: [], platform, source: "linux-none" };
    }
  }

  return { printers: [], platform, source: "unsupported-platform" };
}

