#!/usr/bin/env node
// Walks src/content/blog/*.md, parses frontmatter for title, and regenerates
// public/assets/<slug>/link.png via generate-share-image.mjs.
// Run after editing the share-image template; otherwise the script is dormant.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '..', 'src', 'content', 'blog');
const GENERATOR = join(__dirname, 'generate-share-image.mjs');

const parseTitle = (text) => {
	const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!m) return null;
	const fm = m[1];
	const titleLine = fm.split('\n').find((l) => l.startsWith('title:'));
	if (!titleLine) return null;
	let title = titleLine.replace(/^title:\s*/, '').trim();
	if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
		title = title.slice(1, -1);
	}
	return title;
};

const run = (slug, title) =>
	new Promise((resolve, reject) => {
		const p = spawn('node', [GENERATOR, slug, title], { stdio: 'inherit' });
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
	const title = parseTitle(text);
	if (!title) {
		console.warn(`skip ${slug}: no title in frontmatter`);
		skipped++;
		continue;
	}
	await run(slug, title);
	ok++;
}

console.log(`\nregenerated ${ok} share images, skipped ${skipped}`);
