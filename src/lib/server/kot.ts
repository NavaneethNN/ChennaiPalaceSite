import "server-only";
import PDFDocument from "pdfkit";
import path from "node:path";
import type { OrderItem } from "../types";
export type Ticket = {
  id: string;
  table_number: number;
  session_id: string;
  notes: string;
  decided_at: string;
  items: OrderItem[];
};
export async function kotPdf(
  ticket: Ticket,
  destination?: string,
): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false, margin: 22 });
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
    doc.addPage({
      margin: 22,
      size: [
        226.77,
        Math.max(
          350,
          230 +
            items.reduce(
              (n, i) => n + 40 + Math.ceil(i.name.length / 24) * 15,
              0,
            ) +
            Math.ceil(ticket.notes.length / 25) * 13,
        ),
      ],
    });
    doc
      .font("Palace")
      .fontSize(15)
      .text("CHENNAI PALACE", { align: "center" })
      .moveDown(0.5);
    doc
      .fontSize(18)
      .text(`${printer.toUpperCase()} KOT`, { align: "center" })
      .moveDown(0.5);
    doc
      .fontSize(19)
      .text(`TABLE ${ticket.table_number}`, { align: "center" })
      .moveDown(0.4);
    doc
      .fontSize(9)
      .text(`Order ${ticket.id.slice(0, 8).toUpperCase()}`)
      .text(`Session ${ticket.session_id.slice(0, 8).toUpperCase()}`)
      .text(
        new Date(ticket.decided_at).toLocaleString("en-AU", {
          timeZone: "Australia/Adelaide",
        }),
      )
      .moveDown();
    doc.moveTo(22, doc.y).lineTo(204, doc.y).stroke();
    doc.moveDown();
    for (const item of items)
      doc.fontSize(14).text(`${item.quantity} x ${item.name}`).moveDown(0.6);
    if (ticket.notes)
      doc.moveDown(0.5).fontSize(10).text(`ORDER NOTES: ${ticket.notes}`);
    doc
      .moveDown()
      .fontSize(8)
      .text("Kitchen order ticket - not a tax invoice", { align: "center" });
  }
  doc.end();
  return finished;
}
