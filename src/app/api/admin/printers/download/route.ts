import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { staff } from "@/lib/server/auth";
import { failure } from "@/lib/server/http";
import { createZipBuffer } from "@/lib/server/zip";

export const runtime = "nodejs";

const README_CONTENT = `CHENNAI PALACE - WINDOWS THERMAL PRINTER BRIDGE
=====================================================

QUICK SETUP GUIDE (Takes under 15 seconds):

1. Keep 'windows-printer-bridge.bat' and 'windows-printer-bridge.ps1'
   together in the same folder on your Windows POS machine.

2. Double-click 'windows-printer-bridge.bat'
   - If Windows asks for Administrator permission, click "Yes".
   - This automatically configures Windows Firewall and port 18080.

3. Keep the bridge terminal window open during restaurant service hours.

4. On your Admin Panel (Printers tab):
   - If using this Windows PC: leave IP as 127.0.0.1 and click "Scan Windows printers".
   - If accessing from a Mac or iPad: enter the Windows PC IP shown in the bridge window.
   - Assign one printer to "Kitchen" and one to "Cashier".

Your continuous thermal KOT prints will now be dispatched instantly and seamlessly!
`;

export async function GET(request: Request) {
  try {
    await staff();
    const url = new URL(request.url);
    const requestedFile = (url.searchParams.get("file") || "").trim().toLowerCase();

    const scriptsDir = join(process.cwd(), "scripts");
    const batPath = join(scriptsDir, "windows-printer-bridge.bat");
    const ps1Path = join(scriptsDir, "windows-printer-bridge.ps1");

    const [batContent, ps1Content] = await Promise.all([
      readFile(batPath, "utf8").catch(() => ""),
      readFile(ps1Path, "utf8").catch(() => ""),
    ]);

    if (!batContent || !ps1Content) {
      throw new Error("Printer bridge script files could not be located on server.");
    }

    if (requestedFile === "windows-printer-bridge.bat" || requestedFile === "bat") {
      return new Response(batContent, {
        status: 200,
        headers: {
          "Content-Type": "application/x-bat; charset=utf-8",
          "Content-Disposition": 'attachment; filename="windows-printer-bridge.bat"',
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    if (requestedFile === "windows-printer-bridge.ps1" || requestedFile === "ps1") {
      return new Response(ps1Content, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": 'attachment; filename="windows-printer-bridge.ps1"',
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // Default or requestedFile === 'zip': serve complete bundle
    const zipBuffer = createZipBuffer([
      { name: "windows-printer-bridge.bat", content: batContent },
      { name: "windows-printer-bridge.ps1", content: ps1Content },
      { name: "README.txt", content: README_CONTENT },
    ]);

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="chennai-palace-printer-bridge.zip"',
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
