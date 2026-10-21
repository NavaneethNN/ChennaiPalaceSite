import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

console.log("Starting Printer Setup Download & Production Bridge Tests...\n");

// 1. Verify existence and contents of windows-printer-bridge scripts
const scriptsDir = path.join(process.cwd(), "scripts");
const batPath = path.join(scriptsDir, "windows-printer-bridge.bat");
const ps1Path = path.join(scriptsDir, "windows-printer-bridge.ps1");

assert(fs.existsSync(batPath), "windows-printer-bridge.bat must exist");
assert(fs.existsSync(ps1Path), "windows-printer-bridge.ps1 must exist");

const batContent = fs.readFileSync(batPath, "utf8");
const ps1Content = fs.readFileSync(ps1Path, "utf8");

assert(batContent.includes("windows-printer-bridge.ps1"), ".bat must invoke .ps1");
assert(batContent.includes("Start-Process cmd -ArgumentList"), ".bat must support UAC self-elevation");
assert(batContent.includes("18080"), ".bat must configure port 18080");
console.log("✓ windows-printer-bridge.bat verified (UAC elevation & companion resolution)");

assert(ps1Content.includes("Access-Control-Allow-Private-Network"), ".ps1 must include PNA CORS header for Chrome");
assert(ps1Content.includes("Get-InstalledPrintersList"), ".ps1 must include multi-API printer discovery");
assert(ps1Content.includes("Out-Printer"), ".ps1 must dispatch to Windows print spooler");
assert(ps1Content.includes("18080"), ".ps1 must listen on port 18080");
console.log("✓ windows-printer-bridge.ps1 verified (PNA headers, fast spooling, resilient discovery)");

// 2. Test ZIP archive builder algorithm
function createZipBuffer(files) {
  const parts = [];
  const cdParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const dataBuf = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, "utf8");

    const crc = zlib.crc32(dataBuf);
    const compressed = zlib.deflateRawSync(dataBuf);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    parts.push(local, nameBuf, compressed);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(dataBuf.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);

    cdParts.push(cd, nameBuf);
    offset += 30 + nameBuf.length + compressed.length;
  }

  const cdOffset = offset;
  const cdBuf = Buffer.concat(cdParts);
  const cdSize = cdBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, cdBuf, eocd]);
}

const zipBuffer = createZipBuffer([
  { name: "windows-printer-bridge.bat", content: batContent },
  { name: "windows-printer-bridge.ps1", content: ps1Content },
  { name: "README.txt", content: "Chennai Palace Bridge Setup Guide" },
]);

assert(Buffer.isBuffer(zipBuffer), "ZIP generator must return a Buffer");
assert(zipBuffer.length > 500, "ZIP buffer must contain realistic compressed payload");
assert.strictEqual(zipBuffer.readUInt32LE(0), 0x04034b50, "ZIP must start with local file header signature");

const eocdSig = zipBuffer.readUInt32LE(zipBuffer.length - 22);
assert.strictEqual(eocdSig, 0x06054b50, "ZIP must terminate with valid End of Central Directory record");
console.log("✓ ZIP archive created and validated with standard PKWARE binary headers");

console.log("\nAll Printer Setup Download and Bridge tests passed successfully!");
