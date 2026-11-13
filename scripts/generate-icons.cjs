const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

const logoPath = path.resolve(__dirname, '../public/logo/logo.png');
const outDir = path.resolve(__dirname, '../public/icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// If public/logo/logo.png exists, generate icons using sips on macOS
if (fs.existsSync(logoPath)) {
  console.log(`Found logo at ${logoPath}. Generating icons from logo...`);
  try {
    [16, 32, 48, 128].forEach(size => {
      const target = path.join(outDir, `icon${size}.png`);
      execSync(`sips -z ${size} ${size} "${logoPath}" --out "${target}"`, { stdio: 'inherit' });
      console.log(`Generated icon${size}.png from logo.`);
    });
    process.exit(0);
  } catch (err) {
    console.warn("sips command failed, falling back to algorithmic PNG generator:", err);
  }
}

// Fallback pure PNG generator
function createPng(width, height, drawFn) {
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeInt32BE(crc, 8 + len);
  return buf;
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

function iconDrawer(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx + 0.5;
  const dy = y - cy + 0.5;
  const cornerRadius = w * 0.28;
  const inBoxX = Math.abs(dx) <= (cx - cornerRadius);
  const inBoxY = Math.abs(dy) <= (cy - cornerRadius);
  let insideBg = false;

  if (inBoxX || inBoxY) {
    insideBg = Math.abs(dx) <= cx && Math.abs(dy) <= cy;
  } else {
    const cornerDx = Math.abs(dx) - (cx - cornerRadius);
    const cornerDy = Math.abs(dy) - (cy - cornerRadius);
    insideBg = (cornerDx * cornerDx + cornerDy * cornerDy) <= (cornerRadius * cornerRadius);
  }

  if (!insideBg) return [0, 0, 0, 0];

  const dotCx = cx + w * 0.22;
  const dotCy = cy - h * 0.22;
  const dotDist = Math.sqrt((x - dotCx) ** 2 + (y - dotCy) ** 2);
  if (dotDist <= w * 0.14) return [169, 240, 195, 255];

  const dist1 = distToSegment(x / w, y / h, 0.28, 0.52, 0.45, 0.68);
  const dist2 = distToSegment(x / w, y / h, 0.45, 0.68, 0.72, 0.36);
  if (Math.min(dist1, dist2) < 0.08) return [169, 240, 195, 255];

  return [23, 61, 55, 255];
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
}

[16, 32, 48, 128].forEach(size => {
  const png = createPng(size, size, iconDrawer);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
});
