#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const LOGO_PATH = join(PUBLIC_DIR, 'favicon.png');

const usage = `Usage: node scripts/generate-share-image.mjs <slug> <title> [tagline]
  slug    e.g. 2026-05-25-building-a-film-picker-with-claude-code
  title   the post title (will be wrapped at ~22 chars per line)
  tagline optional one-liner under the brand mark; if omitted, no tagline is rendered
Writes to public/assets/<slug>/link.png at 1200x630.`;

const [, , slug, title, tagline] = process.argv;
if (!slug || !title) {
	console.error(usage);
	process.exit(1);
}

const wrap = (text, max) => {
	const words = text.split(/\s+/);
	const lines = [];
	let cur = '';
	for (const w of words) {
		if ((cur + ' ' + w).trim().length > max) {
			if (cur) lines.push(cur);
			cur = w;
		} else {
			cur = (cur + ' ' + w).trim();
		}
	}
	if (cur) lines.push(cur);
	return lines;
};

const escape = (s) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const titleLines = wrap(title, 22);
const fontSize = titleLines.length > 3 ? 64 : titleLines.length > 2 ? 76 : 92;
const lineHeight = fontSize * 1.12;
const totalTitleHeight = titleLines.length * lineHeight;
const titleStartY = (630 - totalTitleHeight) / 2 + fontSize * 0.8;

// Symbol → white linework on transparent. favicon.png has black icon lines
// over an opaque white interior, so a raw-pixel pass: bright = drop alpha,
// dark = tint white.
const { data: rawData, info: rawInfo } = await sharp(LOGO_PATH)
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });
const { width: lw, height: lh, channels: lc } = rawInfo;
const tinted = Buffer.from(rawData);
for (let i = 0; i < lw * lh; i++) {
	const o = i * lc;
	const luminance = (tinted[o] + tinted[o + 1] + tinted[o + 2]) / 3;
	if (luminance > 200) {
		tinted[o + 3] = 0;
	} else {
		tinted[o] = 255;
		tinted[o + 1] = 255;
		tinted[o + 2] = 255;
	}
}
const whiteLogoBuffer = await sharp(tinted, { raw: { width: lw, height: lh, channels: lc } })
	.png()
	.toBuffer();
const logoBase64 = whiteLogoBuffer.toString('base64');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f1219"/>
      <stop offset="100%" stop-color="#1a2030"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="8" height="630" fill="#2337ff"/>

  <!-- Brand lockup, top-left -->
  <image href="data:image/png;base64,${logoBase64}" x="56" y="48" width="52" height="52"/>
  <text x="120" y="84" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff" letter-spacing="2">HUNGOVERCODERS</text>

  <!-- Title, centred vertically -->
  ${titleLines
		.map(
			(line, i) =>
				`<text x="60" y="${titleStartY + i * lineHeight}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${escape(line)}</text>`,
		)
		.join('\n  ')}
${tagline ? `\n  <text x="60" y="570" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#8a93a8">${escape(tagline)}</text>` : ''}
</svg>`;

const outDir = join(PUBLIC_DIR, 'assets', slug);
const outPath = join(outDir, 'link.png');
await mkdir(outDir, { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log(`wrote ${outPath} (1200x630)`);
