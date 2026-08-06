const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPngBuffer(width, height, r, g, b) {
  // PNG header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: 2 (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data: height rows, each starts with filter byte 0, followed by width * 3 bytes (RGB)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    rawData[rowStart] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 3;

      // Draw a nice rounded box / receipt shape in the center
      const margin = Math.floor(width * 0.2);
      const inBox = x >= margin && x < width - margin && y >= margin && y < height - margin;

      if (inBox) {
        // Inner receipt white #FFFFFF
        rawData[idx] = 255;
        rawData[idx + 1] = 255;
        rawData[idx + 2] = 255;
      } else {
        // Background color #2563EB (RGB: 37, 99, 235)
        rawData[idx] = r;
        rawData[idx + 1] = g;
        rawData[idx + 2] = b;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicIconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(publicIconsDir)) {
  fs.mkdirSync(publicIconsDir, { recursive: true });
}

// Generate #2563EB background icons
const icon192 = createPngBuffer(192, 192, 37, 99, 235);
fs.writeFileSync(path.join(publicIconsDir, 'icon-192.png'), icon192);

const icon512 = createPngBuffer(512, 512, 37, 99, 235);
fs.writeFileSync(path.join(publicIconsDir, 'icon-512.png'), icon512);

const appleTouchIcon = createPngBuffer(180, 180, 37, 99, 235);
fs.writeFileSync(path.join(publicIconsDir, 'apple-touch-icon.png'), appleTouchIcon);

const favicon = createPngBuffer(32, 32, 37, 99, 235);
fs.writeFileSync(path.join(__dirname, '../public/favicon.ico'), favicon);

console.log('Icone PWA create con successo!');
