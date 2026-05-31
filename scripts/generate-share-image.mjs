#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const LOGO_PATH = join(PUBLIC_DIR, 'favicon.png');
const PORTRAIT_PATH = join(PUBLIC_DIR, 'assets', 'datagriff.png');

const usage = `Usage: node scripts/generate-share-image.mjs <slug> <title> [tagline]
  slug    e.g. 2026-05-25-building-a-film-picker-with-claude-code
  title   the post title (will be wrapped at ~22 chars per line)
  tagline optional one-liner under the title (else "by dataGriff")
Writes to public/assets/<slug>/link.png at 1200x630.`;

const [, , slug, title, tagline = 'by dataGriff'] = process.argv;
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
const fontSize = titleLines.length > 3 ? 60 : titleLines.length > 2 ? 72 : 84;
const lineHeight = fontSize * 1.12;
const totalTitleHeight = titleLines.length * lineHeight;
const titleStartY = (630 - totalTitleHeight) / 2 + fontSize * 0.8;
const titleEndY = titleStartY + (titleLines.length - 1) * lineHeight + fontSize * 0.15;

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
const portraitBase64 = (await readFile(PORTRAIT_PATH)).toString('base64');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f1219"/>
      <stop offset="100%" stop-color="#1a2030"/>
    </linearGradient>
    <radialGradient id="glow" cx="20%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#2337ff" stop-opacity="0.18"/>
      <stop offset="60%" stop-color="#2337ff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="portrait-clip">
      <circle cx="1080" cy="100" r="64"/>
    </clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="0" width="12" height="630" fill="#2337ff"/>

  <!-- Brand lockup: symbol + wordmark, top-left -->
  <image href="data:image/png;base64,${logoBase64}" x="50" y="40" width="64" height="64"/>
  <text x="124" y="86" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="800" fill="#ffffff" letter-spacing="2">HUNGOVERCODERS</text>

  <!-- Author portrait, top-right -->
  <circle cx="1080" cy="100" r="66" fill="none" stroke="#2337ff" stroke-width="3"/>
  <image href="data:image/png;base64,${portraitBase64}" x="1016" y="36" width="128" height="128" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait-clip)"/>

  <!-- Title -->
  ${titleLines
		.map(
			(line, i) =>
				`<text x="60" y="${titleStartY + i * lineHeight}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${escape(line)}</text>`,
		)
		.join('\n  ')}

  <!-- Accent rule under the title -->
  <rect x="60" y="${titleEndY + 18}" width="80" height="4" fill="#2337ff"/>

  <!-- Tagline + URL -->
  <text x="60" y="${titleEndY + 70}" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#a0a8b8">${escape(tagline)}</text>
  <text x="1140" y="580" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="600" fill="#606f9f" letter-spacing="1">hungovercoders.com</text>
</svg>`;

const outDir = join(PUBLIC_DIR, 'assets', slug);
const outPath = join(outDir, 'link.png');
await mkdir(outDir, { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log(`wrote ${outPath} (1200x630)`);
