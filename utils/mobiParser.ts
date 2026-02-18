
/**
 * A lightweight MOBI (PalmDOC) parser for the browser.
 * Extracts text content from standard uncompressed or PalmDOC-compressed MOBI files.
 */

export async function parseMobi(buffer: ArrayBuffer): Promise<string> {
  const data = new DataView(buffer);
  
  // 1. Parse PDB Header
  // The unique ID seed is at offset 68 (4 bytes), header len usually ends around 78.
  // Number of Records is at offset 76 (2 bytes).
  const numRecords = data.getUint16(76, false);
  
  // 2. Read Record Offsets
  // Record Info list starts at 78. Each entry is 8 bytes (4 byte offset, 4 byte attr).
  const recordOffsets: number[] = [];
  for (let i = 0; i < numRecords; i++) {
    const offset = data.getUint32(78 + i * 8, false);
    recordOffsets.push(offset);
  }

  // 3. Read Record 0 (PalmDOC Header / MOBI Header)
  // The first record points to the start of the MOBI header data.
  const headerOffset = recordOffsets[0];
  
  // Compression is at offset 0 of the PalmDOC header (2 bytes).
  // 1 = No Compression, 2 = PalmDOC, 17480 = HUFF/CDIC
  const compression = data.getUint16(headerOffset, false);
  
  // Text Record Count is at offset 8 of the PalmDOC header (2 bytes).
  const textRecordCount = data.getUint16(headerOffset + 8, false);

  // Validate limits
  if (textRecordCount > numRecords) {
    throw new Error("Invalid MOBI file: text record count exceeds total records.");
  }

  let fullText = "";

  // 4. Decode Text Records
  // Text records usually start immediately after Record 0 (so, indices 1 to textRecordCount).
  for (let i = 1; i <= textRecordCount; i++) {
    // Safety check for bounds
    if (i >= recordOffsets.length) break;
    
    const start = recordOffsets[i];
    const end = (i + 1 < recordOffsets.length) ? recordOffsets[i + 1] : buffer.byteLength;
    
    // Validate record size
    if (start >= buffer.byteLength || end > buffer.byteLength || end <= start) continue;
    
    const chunk = new Uint8Array(buffer.slice(start, end));
    
    if (compression === 2) {
      // PalmDOC Compression
      fullText += decompressPalmDOC(chunk);
    } else if (compression === 1) {
      // No Compression
      fullText += new TextDecoder('utf-8').decode(chunk); // Try UTF-8 first
    } else {
      // Huff/CDIC or others
      return `<div style="padding:20px; text-align:center; color: red;">
        <h3>Unsupported Compression</h3>
        <p>This MOBI file uses Huff/CDIC compression which is not currently supported in this web reader.</p>
        <p>Please convert it to standard EPUB or TXT.</p>
      </div>`;
    }
  }

  return fullText;
}

/**
 * Decompresses PalmDOC (LZ77 variant) byte arrays into a string.
 */
function decompressPalmDOC(data: Uint8Array): string {
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
      // Literal character (0x00..0x7F) except 0x00 which is null
      output.push(byte);
    } else if (byte >= 0xC0) {
      // Space + character pair
      output.push(32); // ' '
      output.push(byte ^ 0x80); // The char is byte XOR 0x80
    } else {
      // 0x80..0xBF: LZ77 Distance/Length pair
      // Sequence is 2 bytes: 10xxxxxx yyyyyyyy
      if (p >= data.length) break;
      const nextByte = data[p++];
      
      // Distance = (Top 6 bits of byte1) << 5 | (Top 5 bits of byte2)
      // Actually: distance = ( (byte & 0x3F) << 5 ) | ( (nextByte & 0xF8) >> 3 ) ? No.
      // Standard PalmDOC:
      // distance = ( (first_byte & 0x3F) << 5 ) | ( second_byte >> 3 )
      // length = ( second_byte & 0x07 ) + 3
      
      const distance = ((byte & 0x3F) << 5) | (nextByte >> 3);
      const length = (nextByte & 0x07) + 3;
      
      let src = output.length - distance;
      // Copy 'length' bytes from 'distance' back
      for (let i = 0; i < length; i++) {
        if (src + i >= 0 && src + i < output.length) {
          output.push(output[src + i]);
        }
      }
    }
  }
  
  // Decoding strategy: Try UTF-8, if invalid, it might be CP1252 (Latin-1) which is common in older MOBIs.
  // TextDecoder 'utf-8' with fatal:false will replace invalid with , which is acceptable.
  return new TextDecoder('utf-8').decode(new Uint8Array(output));
}
