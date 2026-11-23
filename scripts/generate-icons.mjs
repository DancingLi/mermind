import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, '../build');
const svgPath = path.join(buildDir, 'icon.svg');
const pngPath = path.join(buildDir, 'icon.png');
const icnsPath = path.join(buildDir, 'icon.icns');
const icoPath = path.join(buildDir, 'icon.ico');
const iconsetDir = path.join(buildDir, 'icon.iconset');

if (process.platform !== 'darwin') {
  console.log('Icon generation via macOS qlmanage/sips/iconutil is intended for macOS; committed icons will be used.');
  process.exit(0);
}

// Render SVG -> 1024x1024 PNG using macOS qlmanage or sips fallback
const tmpDir = path.join(buildDir, '.icon-tmp');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

execFileSync('qlmanage', ['-t', '-s', '1024', '-o', tmpDir, svgPath], { stdio: 'pipe' });
const rendered = path.join(tmpDir, 'icon.svg.png');
if (!fs.existsSync(rendered)) {
  throw new Error('Failed to render SVG to PNG via qlmanage');
}
fs.copyFileSync(rendered, pngPath);

// Generate macOS .icns
fs.rmSync(iconsetDir, { recursive: true, force: true });
fs.mkdirSync(iconsetDir, { recursive: true });

const icnsSizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];

for (const [size, filename] of icnsSizes) {
  execFileSync('sips', ['-z', String(size), String(size), pngPath, '--out', path.join(iconsetDir, filename)], {
    stdio: 'pipe',
  });
}
execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath], { stdio: 'pipe' });

// Generate multi-size Windows .ico (PNG-in-ICO format supported by Windows Vista+ and electron-builder)
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = icoSizes.map((size) => {
  const out = path.join(tmpDir, `ico_${size}.png`);
  execFileSync('sips', ['-z', String(size), String(size), pngPath, '--out', out], { stdio: 'pipe' });
  return { size, data: fs.readFileSync(out) };
});

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type 1 = ICO
header.writeUInt16LE(pngBuffers.length, 4);

const entries = [];
let offset = 6 + pngBuffers.length * 16;
for (const { size, data } of pngBuffers) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  entries.push(entry);
  offset += data.length;
}

fs.writeFileSync(icoPath, Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.data)]));

// Clean temporary directories
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.rmSync(iconsetDir, { recursive: true, force: true });

console.log('Generated build/icon.png, build/icon.icns, build/icon.ico');
