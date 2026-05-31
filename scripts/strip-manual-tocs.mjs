#!/usr/bin/env node
// One-shot cleanup: blog posts hand-wrote a list of anchor-links near the top
// of each post that acted as a Table of Contents. The BlogPost layout now
// generates one automatically from h2 headings, so those manual lists are
// redundant. This script detects contiguous runs of 3+ TOC-style lines and
// strips them.
//
// A TOC line is "(indent)- [text](#anchor-slug)" with nothing else on it.
// The threshold of 3 avoids false-flagging incidental anchor bullets in prose.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '..', 'src', 'content', 'blog');

const TOC_LINE = /^\s*-\s+\[[^\]]+\]\(#[a-z0-9-]+\)\s*$/;
const MIN_RUN = 3;

const stripTocs = (text) => {
	const lines = text.split('\n');
	const out = [];
	let i = 0;
	let removed = 0;

	while (i < lines.length) {
		// Try to detect a run starting at i
		let j = i;
		while (j < lines.length && TOC_LINE.test(lines[j])) j++;
		const runLength = j - i;

		if (runLength >= MIN_RUN) {
			// Strip the run, and also strip a single trailing blank line if
			// the line before the run is also blank — keeps spacing tidy.
			const prevBlank = out.length > 0 && out[out.length - 1].trim() === '';
			const nextBlank = j < lines.length && lines[j].trim() === '';
			if (prevBlank && nextBlank) i = j + 1;
			else i = j;
			removed += runLength;
			continue;
		}

		out.push(lines[i]);
		i++;
	}

	return { text: out.join('\n'), removed };
};

const files = (await readdir(BLOG_DIR, { withFileTypes: true }))
	.filter((d) => d.isFile() && d.name.endsWith('.md'))
	.map((d) => d.name);

let totalRemoved = 0;
let postsTouched = 0;
const unchanged = [];

for (const file of files) {
	const path = join(BLOG_DIR, file);
	const text = await readFile(path, 'utf-8');
	const { text: cleaned, removed } = stripTocs(text);
	if (removed > 0) {
		await writeFile(path, cleaned);
		console.log(`${file}: stripped ${removed} TOC lines`);
		totalRemoved += removed;
		postsTouched++;
	} else {
		unchanged.push(file);
	}
}

console.log(`\n${postsTouched} posts updated, ${unchanged.length} unchanged, ${totalRemoved} lines removed total`);
if (unchanged.length > 0) {
	console.log('Unchanged:');
	for (const f of unchanged) console.log('  ' + f);
}
