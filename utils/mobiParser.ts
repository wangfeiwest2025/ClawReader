
/**
 * A lightweight MOBI (PalmDOC) parser for the browser.
 * Extracts text content from standard uncompressed or PalmDOC-compressed MOBI files.
 */

export async function parseMobi(buffer: ArrayBuffer): Promise<string> {
  const data = new DataView(buffer);
  
  // 1. Parse PDB Header
  const numRecords = data.getUint16(76, false);
  
  // 2. Read Record Offsets
  const recordOffsets: number[] = [];
  for (let i = 0; i < numRecords; i++) {
    const offset = data.getUint32(78 + i * 8, false);
    recordOffsets.push(offset);
  }

  // 3. Read Record 0 (PalmDOC Header / MOBI Header)
  const headerOffset = recordOffsets[0];
  const compression = data.getUint16(headerOffset, false);
  const textRecordCount = data.getUint16(headerOffset + 8, false);

  if (textRecordCount > numRecords) {
    throw new Error("Invalid MOBI file: text record count exceeds total records.");
  }

  // Collect all raw bytes first (do not decode chunk by chunk to avoid breaking multi-byte chars)
  let allChunks: Uint8Array[] = [];
  let totalLength = 0;

  // 4. Decode Text Records
  for (let i = 1; i <= textRecordCount; i++) {
    if (i >= recordOffsets.length) break;
    
    const start = recordOffsets[i];
    const end = (i + 1 < recordOffsets.length) ? recordOffsets[i + 1] : buffer.byteLength;
    
    if (start >= buffer.byteLength || end > buffer.byteLength || end <= start) continue;
    
    const chunk = new Uint8Array(buffer.slice(start, end));
    let decodedChunk: Uint8Array;

    if (compression === 2) {
      // PalmDOC Compression
      decodedChunk = decompressPalmDOC(chunk);
    } else if (compression === 1) {
      // No Compression
      decodedChunk = chunk;
    } else {
      // Huff/CDIC or others
      return `<div style="padding:20px; text-align:center; color: red;">
        <h3>Unsupported Compression</h3>
        <p>This MOBI file uses Huff/CDIC compression which is not currently supported in this web reader.</p>
        <p>Please convert it to standard EPUB or TXT.</p>
      </div>`;
    }
    
    allChunks.push(decodedChunk);
    totalLength += decodedChunk.length;
  }

  // 5. Concatenate all chunks
  const finalBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of allChunks) {
    finalBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  // 6. Decode Text (Handle Encodings: UTF-8 -> GBK -> Latin1)
  try {
    // Try strict UTF-8 first
    return new TextDecoder('utf-8', { fatal: true }).decode(finalBuffer);
  } catch (e) {
    try {
      // Try GBK (Common for Chinese MOBI)
      return new TextDecoder('gbk', { fatal: true }).decode(finalBuffer);
    } catch (e2) {
      // Fallback: Lax UTF-8 (replaces invalid chars)
      return new TextDecoder('utf-8', { fatal: false }).decode(finalBuffer);
    }
  }
}

/**
 * Decompresses PalmDOC (LZ77 variant) byte arrays into a raw Uint8Array.
 */
function decompressPalmDOC(data: Uint8Array): Uint8Array {
  const output: number[] = [];
  let p = 0;
  
  while (p < data.length) {
    const byte = data[p++];
    
    if (byte >= 0x01 && byte <= 0x08) {
      // Copy next 'byte' bytes literally
      for (let i = 0; i < byte; i++) {
        if (p < data.length) output.push(data[p++]);
      }
    } else if (byte < 0x80) {
      // Literal character (0x00..0x7F)
      output.push(byte);
    } else if (byte >= 0xC0) {
      // Space + character pair
      output.push(32); // ' '
      output.push(byte ^ 0x80);
    } else {
      // LZ77 Distance/Length pair
      if (p >= data.length) break;
      const nextByte = data[p++];
      
      const distance = ((byte & 0x3F) << 5) | (nextByte >> 3);
      const length = (nextByte & 0x07) + 3;
      
      let src = output.length - distance;
      for (let i = 0; i < length; i++) {
        if (src + i >= 0 && src + i < output.length) {
          output.push(output[src + i]);
        }
      }
    }
  }
  
  return new Uint8Array(output);
}
