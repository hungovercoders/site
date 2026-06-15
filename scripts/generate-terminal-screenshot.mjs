#!/usr/bin/env node
// Render a terminal capture to PNG using the same SVG → sharp pipeline as
// generate-share-image.mjs. Stdin = the raw terminal text. Args:
//   --out <path>      where to write the PNG
//   --title <string>  fake window title-bar text (defaults to "Terminal")
//   --width <px>      output width (default 1400)
//   --browser         render as a browser chrome instead of terminal (for /pr-checks)

import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
let out = null;
let title = 'Terminal — slopstopper install';
let width = 1400;
let browser = false;
for (let i = 0; i < args.length; i++) {
	if (args[i] === '--out') out = args[++i];
	else if (args[i] === '--title') title = args[++i];
	else if (args[i] === '--width') width = parseInt(args[++i], 10);
	else if (args[i] === '--browser') browser = true;
}
if (!out) {
	console.error('Usage: ... | node scripts/generate-terminal-screenshot.mjs --out <path> [--title "..."] [--width 1400] [--browser]');
	process.exit(1);
}

const text = await new Promise((resolve) => {
	let data = '';
	process.stdin.on('data', (c) => { data += c; });
	process.stdin.on('end', () => resolve(data));
});

// Strip ANSI escape sequences (cheaply — covers SGR + cursor codes).
const stripped = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
const lines = stripped.replace(/\r/g, '').split('\n');
// Drop trailing blank lines but keep internal ones.
while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

const fontSize = 16;
const lineHeight = fontSize * 1.45;
const padX = 28;
const padTop = browser ? 100 : 56;
const padBottom = 28;
const contentHeight = lines.length * lineHeight;
const height = Math.max(420, Math.ceil(padTop + contentHeight + padBottom));

const escape = (s) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Highlight common terminal markers (✅ ❌ ⚠️ green-ish for success, red for fail).
const colorise = (line) => {
	const e = escape(line);
	if (/^\s*✅|\bpassed\b|\bSUCCESS\b|\bgreen\b|\bAll .* pass\b/i.test(line))
		return `<tspan fill="#4ade80">${e}</tspan>`;
	if (/^\s*❌|\bfailed\b|\bFAIL\b|\berror\b/i.test(line))
		return `<tspan fill="#f87171">${e}</tspan>`;
	if (/^\s*⚠️|\bwarn\b|\bwarning\b/i.test(line))
		return `<tspan fill="#fbbf24">${e}</tspan>`;
	if (/^\s*[#$]\s|\$\s|^[➜>]/i.test(line))
		return `<tspan fill="#60a5fa">${e}</tspan>`;
	if (/^\s*ℹ️|^\s*🔍|^\s*📚|^\s*📁|^\s*🎉|^\s*━━━━/.test(line))
		return `<tspan fill="#a5b4fc">${e}</tspan>`;
	return e;
};

const chrome = browser
	? `
    <rect width="${width}" height="${padTop - 12}" fill="#202024"/>
    <circle cx="22" cy="22" r="6" fill="#ff5f57"/>
    <circle cx="42" cy="22" r="6" fill="#febc2e"/>
    <circle cx="62" cy="22" r="6" fill="#28c840"/>
    <rect x="100" y="12" width="${width - 220}" height="24" rx="4" fill="#34343a"/>
    <text x="${width / 2}" y="30" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#9ca3af">${escape(title)}</text>
    <rect x="20" y="52" width="${width - 40}" height="32" rx="4" fill="#2a2a2e"/>
    <text x="36" y="74" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#9ca3af">github.com / hungovercoders / site · PR #29 · checks</text>`
	: `
    <rect width="${width}" height="${padTop - 16}" fill="#202024"/>
    <circle cx="22" cy="22" r="6" fill="#ff5f57"/>
    <circle cx="42" cy="22" r="6" fill="#febc2e"/>
    <circle cx="62" cy="22" r="6" fill="#28c840"/>
    <text x="${width / 2}" y="28" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#9ca3af">${escape(title)}</text>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#16161a"/>${chrome}
  <g font-family="Menlo, 'JetBrains Mono', 'Courier New', monospace" font-size="${fontSize}" fill="#e5e7eb">
${lines
		.map(
			(line, i) =>
				`    <text x="${padX}" y="${padTop + (i + 1) * lineHeight - fontSize * 0.3}" xml:space="preserve">${colorise(line)}</text>`,
		)
		.join('\n')}
  </g>
</svg>`;

await mkdir(dirname(out), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`wrote ${out} (${width}x${height})`);
