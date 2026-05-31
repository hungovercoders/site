#!/usr/bin/env node
// Walks src/content/blog/*.md, parses frontmatter title + description, and
// regenerates public/assets/<slug>/link.png via generate-share-image.mjs.
// Run after editing the share-image template; otherwise the script is dormant.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '..', 'src', 'content', 'blog');
const GENERATOR = join(__dirname, 'generate-share-image.mjs');

const TAGLINE_MAX = 60;

const parseFrontmatter = (text) => {
	const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!m) return {};
	const fm = m[1];
	const out = {};
	for (const line of fm.split('\n')) {
		const kv = line.match(/^(title|description):\s*(.+)$/);
		if (!kv) continue;
		let v = kv[2].trim();
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			v = v.slice(1, -1);
		}
		out[kv[1]] = v;
	}
	return out;
};

const trimTagline = (s) => {
	if (!s) return 'by dataGriff';
	if (s.length <= TAGLINE_MAX) return s;
	// truncate at the last word boundary that fits, append ellipsis
	const cut = s.slice(0, TAGLINE_MAX).replace(/\s+\S*$/, '');
	return cut + '…';
};

const run = (slug, title, tagline) =>
	new Promise((resolve, reject) => {
		const p = spawn('node', [GENERATOR, slug, title, tagline], { stdio: 'inherit' });
		p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
	});

const files = (await readdir(BLOG_DIR, { withFileTypes: true }))
	.filter((d) => d.isFile() && d.name.endsWith('.md'))
	.map((d) => d.name);

let ok = 0;
let skipped = 0;
for (const file of files) {
	const slug = file.replace(/\.md$/, '');
	const text = await readFile(join(BLOG_DIR, file), 'utf-8');
	const { title, description } = parseFrontmatter(text);
	if (!title) {
		console.warn(`skip ${slug}: no title in frontmatter`);
		skipped++;
		continue;
	}
	const tagline = trimTagline(description);
	await run(slug, title, tagline);
	ok++;
}

console.log(`\nregenerated ${ok} share images, skipped ${skipped}`);
