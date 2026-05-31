#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const LOGO_PATH = join(PUBLIC_DIR, 'favicon.png');

const usage = `Usage: node scripts/generate-share-image.mjs <slug> <title> [tagline]
  slug    e.g. 2026-05-25-building-a-film-picker-with-claude-code
  title   the post title (will be wrapped at ~24 chars per line)
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

const titleLines = wrap(title, 24);
const fontSize = titleLines.length > 3 ? 64 : 80;
const lineHeight = fontSize * 1.15;
const totalTitleHeight = titleLines.length * lineHeight;
const titleStartY = (630 - totalTitleHeight) / 2 + fontSize * 0.8;

const logoBase64 = (await readFile(LOGO_PATH)).toString('base64');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f1219"/>
      <stop offset="100%" stop-color="#222939"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="630" fill="#2337ff"/>
  <text x="60" y="80" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#2337ff" letter-spacing="2">HUNGOVERCODERS</text>
  <circle cx="1080" cy="100" r="72" fill="#ffffff" opacity="0.95"/>
  <image href="data:image/png;base64,${logoBase64}" x="1010" y="30" width="140" height="140"/>
  ${titleLines
		.map(
			(line, i) =>
				`<text x="60" y="${titleStartY + i * lineHeight}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${escape(line)}</text>`,
		)
		.join('\n  ')}
  <text x="60" y="570" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#a0a8b8">${escape(tagline)}</text>
  <text x="1140" y="570" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#606f9f">hungovercoders.com</text>
</svg>`;

const outDir = join(PUBLIC_DIR, 'assets', slug);
const outPath = join(outDir, 'link.png');
await mkdir(outDir, { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log(`wrote ${outPath} (1200x630)`);
