import type { PaperSize } from "../types";

export type ReceiptTicket = {
  id: string;
  table_number: number;
  session_id: string;
  decided_at: string;
  notes: string;
  items: { quantity: number; name: string; printer: "kitchen" | "cashier" }[];
};

function padCenter(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width);
  const left = Math.floor((width - str.length) / 2);
  const right = width - str.length - left;
  return " ".repeat(left) + str + " ".repeat(right);
}

function divider(width: number, char = "-"): string {
  return char.repeat(width);
}

function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function formatReceiptText(
  ticket: ReceiptTicket,
  destination: "kitchen" | "cashier",
  printerName?: string,
  paperSize: PaperSize = "80mm",
): string {
  const is58 = paperSize === "58mm";
  const cols = is58 ? 32 : 42;
  const items = ticket.items.filter((i) => i.printer === destination);

  if (!items.length) return "";

  const timeStr = new Date(ticket.decided_at).toLocaleString("en-AU", {
    timeZone: "Australia/Adelaide",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines: string[] = [];

  // Header
  lines.push(divider(cols, "="));
  lines.push(padCenter("CHENNAI PALACE", cols));
  lines.push(padCenter(`${destination.toUpperCase()} KOT`, cols));
  lines.push(padCenter(`*** TABLE ${ticket.table_number} ***`, cols));
  lines.push(divider(cols, "="));

  // Metadata
  if (is58) {
    lines.push(`Order: #${ticket.id.slice(0, 8).toUpperCase()}`);
    lines.push(`Time:  ${timeStr}`);
    if (printerName) lines.push(`Device: ${printerName}`);
  } else {
    lines.push(
      `Order: #${ticket.id.slice(0, 8).toUpperCase()}`.padEnd(22) +
        `Time: ${timeStr}`.padStart(cols - 22),
    );
    if (printerName) {
      lines.push(`Device: ${printerName}`);
    }
  }
  lines.push(divider(cols, "-"));

  // Column header
  lines.push("QTY  ITEM");
  lines.push(divider(cols, "-"));

  // Items
  for (const item of items) {
    const qtyPrefix = `${String(item.quantity).padStart(2)} x `;
    const maxItemWidth = cols - qtyPrefix.length;
    const wrappedName = wordWrap(item.name, maxItemWidth);

    lines.push(qtyPrefix + (wrappedName[0] || ""));
    for (let i = 1; i < wrappedName.length; i++) {
      lines.push(" ".repeat(qtyPrefix.length) + wrappedName[i]);
    }
  }

  lines.push(divider(cols, "-"));

  // Notes
  if (ticket.notes && ticket.notes.trim()) {
    lines.push("ORDER NOTES:");
    const wrappedNotes = wordWrap(ticket.notes.trim(), cols);
    for (const line of wrappedNotes) {
      lines.push("  " + line);
    }
    lines.push(divider(cols, "-"));
  }

  // Footer & Tear Feed
  lines.push(padCenter("KITCHEN ORDER TICKET", cols));
  lines.push(padCenter("NOT A TAX INVOICE", cols));
  lines.push(divider(cols, "="));

  // 4 feed lines so receipt rolls cleanly past tear bar
  lines.push("");
  lines.push("");
  lines.push("");
  lines.push("");

  return lines.join("\r\n");
}
