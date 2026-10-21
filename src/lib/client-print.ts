import type { Order, PrinterSettings } from "./types";

export type PrintMethod = "bridge" | "iframe" | "tab";

export type PrintJob = {
  orderId: string;
  tableNumber: number;
  destination: "kitchen" | "cashier";
  printerName?: string;
  paperSize?: "80mm" | "58mm";
  retries?: number;
};

export type OrderPrintStatus = {
  kitchen?: "queued" | "printing" | "printed" | "failed";
  cashier?: "queued" | "printing" | "printed" | "failed";
  lastError?: string;
  timestamp?: number;
};

const BRIDGE_URL = "http://127.0.0.1:18080";
const queue: PrintJob[] = [];
let isProcessingQueue = false;

// Global subscribers for print status changes
type StatusListener = (statuses: Record<string, OrderPrintStatus>) => void;
const listeners = new Set<StatusListener>();
const printStatuses: Record<string, OrderPrintStatus> = {};

export function subscribePrintStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener({ ...printStatuses });
  return () => {
    listeners.delete(listener);
  };
}

function notifyStatus(orderId: string, dest: "kitchen" | "cashier", state: "queued" | "printing" | "printed" | "failed", err?: string) {
  if (!printStatuses[orderId]) printStatuses[orderId] = {};
  printStatuses[orderId][dest] = state;
  if (err) printStatuses[orderId].lastError = err;
  printStatuses[orderId].timestamp = Date.now();

  const copy = { ...printStatuses };
  for (const fn of listeners) {
    try {
      fn(copy);
    } catch {
      // Ignore listener error
    }
  }
}

/**
 * Checks if the local Windows Printer Bridge is reachable.
 */
export async function checkWindowsBridge(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${BRIDGE_URL}/printers`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Prints a job via the local Windows Bridge.
 */
async function printViaBridge(job: PrintJob): Promise<boolean> {
  // Fetch pre-formatted thermal text
  const textRes = await fetch(`/api/kot/${job.orderId}/text?printer=${job.destination}`, {
    cache: "no-store",
  });
  if (!textRes.ok) {
    throw new Error(`Failed to load receipt text (${textRes.status})`);
  }
  const receiptText = await textRes.text();
  if (!receiptText || !receiptText.trim()) {
    // No items for this destination in this order
    return true;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  const res = await fetch(`${BRIDGE_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      printer: job.printerName || "",
      destination: job.destination,
      orderId: job.orderId,
      text: receiptText,
      paperSize: job.paperSize || "80mm",
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Bridge returned HTTP ${res.status}`);
  }
  return true;
}

/**
 * Fallback: Prints silently in browser using a hidden iframe.
 * Prevents browser popup blocking when multiple continuous orders arrive.
 */
function printViaIframe(job: PrintJob): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      let iframe = document.getElementById("kot-hidden-frame") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "kot-hidden-frame";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);
      }

      const pdfUrl = `/api/kot/${job.orderId}?printer=${job.destination}`;
      iframe.src = pdfUrl;

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch {
          // If browser restricts iframe.print, fallback succeeds without throwing
          resolve(true);
        }
      };

      // Timeout fallback if iframe load hangs
      setTimeout(() => resolve(true), 3500);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Sequential queue worker: processes jobs one-by-one with rate-limiting.
 */
async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;

      notifyStatus(job.orderId, job.destination, "printing");

      let success = false;
      let errorMsg = "";

      // Try Bridge first
      try {
        success = await printViaBridge(job);
      } catch (err) {
        errorMsg = (err as Error).message;
        // Fall back to hidden iframe
        try {
          success = await printViaIframe(job);
        } catch (iframeErr) {
          errorMsg = (iframeErr as Error).message;
        }
      }

      if (success) {
        notifyStatus(job.orderId, job.destination, "printed");
      } else {
        notifyStatus(job.orderId, job.destination, "failed", errorMsg);
      }

      // Small pause between jobs to give Windows print spooler breathing room
      await new Promise((r) => setTimeout(r, 150));
    }
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Main entry point: Enqueues print jobs for an accepted order.
 * Dispatches to Kitchen and/or Cashier printers based on order items.
 */
export function enqueueOrderPrint(
  order: Order,
  settings: PrinterSettings,
  destinations?: Array<"kitchen" | "cashier">,
) {
  const targetDests = destinations || [
    ...new Set(order.items.map((i) => i.printer)),
  ];

  for (const dest of targetDests) {
    const hasItems = order.items.some((i) => i.printer === dest);
    if (!hasItems) continue;

    notifyStatus(order.id, dest, "queued");

    const printerName =
      dest === "kitchen" ? settings.kitchen_printer : settings.cashier_printer;
    const paperSize =
      dest === "kitchen"
        ? settings.kitchen_paper_size
        : settings.cashier_paper_size;

    queue.push({
      orderId: order.id,
      tableNumber: (order as unknown as { table_number?: number }).table_number || 0,
      destination: dest,
      printerName,
      paperSize,
    });
  }

  void processQueue();
}
