import "server-only";
import zlib from "node:zlib";

export interface ZipFileEntry {
  name: string;
  content: string | Buffer;
}

/**
 * Creates a standard, fully compliant ZIP archive buffer without external dependencies.
 * Uses Deflate compression with UTF-8 filenames and standard PK headers.
 * Extracts natively in Windows Explorer, macOS Archive Utility, and Linux unzip.
 */
export function createZipBuffer(files: ZipFileEntry[]): Buffer {
  const parts: Buffer[] = [];
  const cdParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const dataBuf = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, "utf8");

    const crc = zlib.crc32(dataBuf);
    const compressed = zlib.deflateRawSync(dataBuf);

    // Local file header (30 bytes + name length)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // Local header signature
    local.writeUInt16LE(20, 4); // Version needed (2.0)
    local.writeUInt16LE(0x0800, 6); // General purpose bit flag: UTF-8
    local.writeUInt16LE(8, 8); // Compression method: Deflate
    local.writeUInt16LE(0, 10); // Last mod file time
    local.writeUInt16LE(0, 12); // Last mod file date
    local.writeUInt32LE(crc, 14); // CRC-32
    local.writeUInt32LE(compressed.length, 18); // Compressed size
    local.writeUInt32LE(dataBuf.length, 22); // Uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // File name length
    local.writeUInt16LE(0, 28); // Extra field length

    parts.push(local, nameBuf, compressed);

    // Central Directory header (46 bytes + name length)
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); // Central directory header signature
    cd.writeUInt16LE(20, 4); // Version made by
    cd.writeUInt16LE(20, 6); // Version needed to extract
    cd.writeUInt16LE(0x0800, 8); // General purpose bit flag: UTF-8
    cd.writeUInt16LE(8, 10); // Compression method: Deflate
    cd.writeUInt16LE(0, 12); // Last mod file time
    cd.writeUInt16LE(0, 14); // Last mod file date
    cd.writeUInt32LE(crc, 16); // CRC-32
    cd.writeUInt32LE(compressed.length, 20); // Compressed size
    cd.writeUInt32LE(dataBuf.length, 24); // Uncompressed size
    cd.writeUInt16LE(nameBuf.length, 28); // File name length
    cd.writeUInt16LE(0, 30); // Extra field length
    cd.writeUInt16LE(0, 32); // File comment length
    cd.writeUInt16LE(0, 34); // Disk number start
    cd.writeUInt16LE(0, 36); // Internal file attributes
    cd.writeUInt32LE(0, 38); // External file attributes
    cd.writeUInt32LE(offset, 42); // Relative offset of local header

    cdParts.push(cd, nameBuf);
    offset += 30 + nameBuf.length + compressed.length;
  }

  const cdOffset = offset;
  const cdBuf = Buffer.concat(cdParts);
  const cdSize = cdBuf.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Number of this disk
  eocd.writeUInt16LE(0, 6); // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8); // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10); // Total number of central directory records
  eocd.writeUInt32LE(cdSize, 12); // Size of central directory
  eocd.writeUInt32LE(cdOffset, 16); // Offset of start of central directory
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...parts, cdBuf, eocd]);
}
