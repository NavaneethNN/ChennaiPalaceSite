import "server-only";
import PDFDocument from "pdfkit";
import path from "node:path";
import type { OrderItem, PaperSize } from "../types";
import { inferPaperSize } from "./printers";

export type Ticket = {
  id: string;
  table_number: number;
  session_id: string;
  notes: string;
  decided_at: string;
  items: OrderItem[];
};

export type PrinterDestConfig = {
  name?: string;
  paperSize?: PaperSize;
};

export async function kotPdf(
  ticket: Ticket,
  destination?: string,
  printerName?: string,
  paperSize?: PaperSize,
  printerConfigs?: Record<string, PrinterDestConfig>,
): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false, margin: 20 });
  // Embed the restaurant font rather than depending on bundled PDFKit AFM assets.
  doc.registerFont("Palace", path.join(process.cwd(), "public/fonts/sans.ttf"));
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  for (const printer of ["kitchen", "cashier"]) {
    if (destination && destination !== printer) continue;
    const items = ticket.items.filter((item) => item.printer === printer);
    if (!items.length) continue;

    const config = printerConfigs?.[printer];
    const activePrinterName =
      config?.name ?? (destination === printer ? printerName : undefined);
    const activePaperSize: PaperSize =
      config?.paperSize ??
      (destination === printer ? paperSize : undefined) ??
      inferPaperSize(activePrinterName);

    const is58 = activePaperSize === "58mm";
    // 58mm = ~164.41pt, 80mm = ~226.77pt
    const pageWidth = is58 ? 164.41 : 226.77;
    const margin = is58 ? 12 : 18;
    const rightMargin = pageWidth - margin;

    const charsPerLine = is58 ? 16 : 24;
    const notesChars = is58 ? 18 : 25;
    const itemHeight = is58 ? 13 : 15;
    const baseHeight = is58 ? 240 : 330;

    const pageHeight = Math.max(
      baseHeight,
      (is58 ? 180 : 220) +
        items.reduce(
          (n, i) =>
            n +
            (is58 ? 26 : 36) +
            Math.ceil(i.name.length / charsPerLine) * itemHeight,
          0,
        ) +
        Math.ceil(ticket.notes.length / notesChars) * (is58 ? 11 : 13),
    );

    doc.addPage({
      margin,
      size: [pageWidth, pageHeight],
    });

    doc
      .font("Palace")
      .fontSize(is58 ? 12 : 15)
      .text("CHENNAI PALACE", { align: "center" })
      .moveDown(0.3);

    doc
      .fontSize(is58 ? 14 : 17)
      .text(`${printer.toUpperCase()} KOT`, { align: "center" })
      .moveDown(0.15);

    if (activePrinterName) {
      doc
        .fontSize(is58 ? 7 : 8)
        .text(
          `PRINTER: ${activePrinterName.toUpperCase()} · ${activePaperSize.toUpperCase()}`,
          { align: "center" },
        )
        .moveDown(0.25);
    } else {
      doc
        .fontSize(is58 ? 7 : 8)
        .text(`PAPER: ${activePaperSize.toUpperCase()}`, { align: "center" })
        .moveDown(0.25);
    }

    doc
      .fontSize(is58 ? 15 : 19)
      .text(`TABLE ${ticket.table_number}`, { align: "center" })
      .moveDown(0.3);

    doc
      .fontSize(is58 ? 8 : 9)
      .text(`Order ${ticket.id.slice(0, 8).toUpperCase()}`)
      .text(`Session ${ticket.session_id.slice(0, 8).toUpperCase()}`)
      .text(
        new Date(ticket.decided_at).toLocaleString("en-AU", {
          timeZone: "Australia/Adelaide",
        }),
      )
      .moveDown(0.4);

    doc.moveTo(margin, doc.y).lineTo(rightMargin, doc.y).stroke();
    doc.moveDown(0.4);

    for (const item of items) {
      doc
        .fontSize(is58 ? 11 : 13.5)
        .text(`${item.quantity} x ${item.name}`)
        .moveDown(is58 ? 0.35 : 0.5);
    }

    if (ticket.notes) {
      doc
        .moveDown(0.3)
        .fontSize(is58 ? 8.5 : 9.5)
        .text(`ORDER NOTES: ${ticket.notes}`);
    }

    doc
      .moveDown(0.5)
      .fontSize(is58 ? 7 : 8)
      .text("Kitchen order ticket - not a tax invoice", { align: "center" });
  }

  doc.end();
  return finished;
}
