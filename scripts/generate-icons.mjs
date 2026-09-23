#!/usr/bin/env node
/**
 * Generate every app icon from build/icon.svg.
 *
 *   node scripts/generate-icons.mjs
 *
 * Rounded (transparent corners): build/icon.png, build/icon.icns, build/icon.ico,
 * docs/assets/*, the renderer favicon and welcome icon, and the icon embedded in
 * HTML exports. Full-bleed (opaque square) for the mobile web app icons, where
 * the OS applies its own mask. .icns needs macOS (iconutil).
 */

import { createCanvas, loadImage } from 'canvas';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(root, p);

const svg = fs.readFileSync(at('build/icon.svg'), 'utf8');
// Full-bleed variant: the background fills the whole square.
const fullBleedSvg = svg.replace(
	/<rect x="100" y="100" width="824" height="824" rx="186"/,
	'<rect x="0" y="0" width="1024" height="1024" rx="0"'
);

const rounded = await loadImage(Buffer.from(svg));
const fullBleed = await loadImage(Buffer.from(fullBleedSvg));

function png(image, size) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(image, 0, 0, size, size);
	return canvas.toBuffer('image/png');
}

function write(rel, data) {
	fs.mkdirSync(path.dirname(at(rel)), { recursive: true });
	fs.writeFileSync(at(rel), data);
	console.log(`✓ ${rel}`);
}

/** ICO container holding PNG-encoded images (supported since Windows Vista). */
function ico(image, sizes) {
	const images = sizes.map((s) => png(image, s));
	const header = Buffer.alloc(6 + 16 * sizes.length);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(sizes.length, 4);
	let offset = header.length;
	sizes.forEach((s, i) => {
		const e = 6 + 16 * i;
		header.writeUInt8(s >= 256 ? 0 : s, e);
		header.writeUInt8(s >= 256 ? 0 : s, e + 1);
		header.writeUInt16LE(1, e + 4);
		header.writeUInt16LE(32, e + 6);
		header.writeUInt32LE(images[i].length, e + 8);
		header.writeUInt32LE(offset, e + 12);
		offset += images[i].length;
	});
	return Buffer.concat([header, ...images]);
}

function icns(image) {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openwizardai-'));
	const iconset = path.join(tmp, 'icon.iconset');
	fs.mkdirSync(iconset);
	for (const s of [16, 32, 128, 256, 512]) {
		fs.writeFileSync(path.join(iconset, `icon_${s}x${s}.png`), png(image, s));
		fs.writeFileSync(path.join(iconset, `icon_${s}x${s}@2x.png`), png(image, s * 2));
	}
	execFileSync('iconutil', ['-c', 'icns', iconset, '-o', at('build/icon.icns')]);
	fs.rmSync(tmp, { recursive: true, force: true });
	console.log('✓ build/icon.icns');
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256];

write('build/icon.png', png(rounded, 1024));
write('build/icon.ico', ico(rounded, icoSizes));
if (process.platform === 'darwin') icns(rounded);
else console.log('- skipped build/icon.icns (needs macOS iconutil)');

write('docs/assets/icon.png', png(rounded, 1024));
write('docs/assets/icon.ico', ico(rounded, icoSizes));
write('docs/assets/openwizardai-app-icon.png', png(rounded, 1024));
write('src/renderer/public/icon.png', png(rounded, 512));
write('src/renderer/assets/icon-wand.png', png(rounded, 512));

for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) {
	write(`src/web/public/icons/icon-${s}x${s}.png`, png(fullBleed, s));
}

// HTML exports embed a 72px icon as a data URI.
const dataUri = `data:image/png;base64,${png(rounded, 72).toString('base64')}`;
for (const rel of ['src/renderer/utils/groupChatExport.ts', 'src/renderer/utils/tabExport.ts']) {
	const source = fs.readFileSync(at(rel), 'utf8');
	const updated = source.replace(
		/(const openwizardaiIconBase64 =\s*')data:image\/png;base64,[A-Za-z0-9+/=]+(')/,
		`$1${dataUri}$2`
	);
	if (updated !== source) write(rel, updated);
}
