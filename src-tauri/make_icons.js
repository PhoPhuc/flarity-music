const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.join(__dirname, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'binary');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function createPng(w, h) {
  const rawData = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    let offset = y * (w * 4 + 1);
    rawData[offset] = 0;
    for (let x = 0; x < w; x++) {
      let px = offset + 1 + x * 4;
      rawData[px] = 13;
      rawData[px+1] = 13;
      rawData[px+2] = 14;
      rawData[px+3] = 255;
    }
  }
  const compressed = zlib.deflateSync(rawData);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = makeChunk('IHDR', header);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdr, idat, iend]);
}

// Build 32x32 BMP for ICO
const width = 32;
const height = 32;
const headerSize = 40;
const pixelBytes = width * height * 4;
const maskBytes = (width * height) / 8;
const imageSize = headerSize + pixelBytes + maskBytes;

const icoFileHeader = Buffer.alloc(6);
icoFileHeader.writeUInt16LE(0, 0);
icoFileHeader.writeUInt16LE(1, 2);
icoFileHeader.writeUInt16LE(1, 4);

const icoDirectory = Buffer.alloc(16);
icoDirectory.writeUInt8(width, 0);
icoDirectory.writeUInt8(height, 1);
icoDirectory.writeUInt8(0, 2);
icoDirectory.writeUInt8(0, 3);
icoDirectory.writeUInt16LE(1, 4);
icoDirectory.writeUInt16LE(32, 6);
icoDirectory.writeUInt32LE(imageSize, 8);
icoDirectory.writeUInt32LE(22, 12);

const bmpHeader = Buffer.alloc(40);
bmpHeader.writeUInt32BE(40, 0); // Note: little endian
bmpHeader.writeUInt32LE(40, 0);
bmpHeader.writeInt32LE(width, 4);
bmpHeader.writeInt32LE(height * 2, 8);
bmpHeader.writeUInt16LE(1, 12);
bmpHeader.writeUInt16LE(32, 14);
bmpHeader.writeUInt32LE(0, 16);
bmpHeader.writeUInt32LE(pixelBytes + maskBytes, 20);

const pixels = Buffer.alloc(pixelBytes);
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 13;
  pixels[i+1] = 13;
  pixels[i+2] = 14;
  pixels[i+3] = 255;
}
const mask = Buffer.alloc(maskBytes, 0);
const icoBuffer = Buffer.concat([icoFileHeader, icoDirectory, bmpHeader, pixels, mask]);

const validPng = createPng(32, 32);
fs.writeFileSync(path.join(iconsDir, '32x32.png'), validPng);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), createPng(128, 128));
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), createPng(256, 256));
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), validPng);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);

console.log("Valid icons generated with CRC!");
