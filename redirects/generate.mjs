#!/usr/bin/env node
// Reads redirect-map.csv and writes src/index.js — the deployed Worker source.
// The CSV is the source of truth; this script is the only thing that should
// write src/index.js. Run before `wrangler deploy`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = join(here, 'redirect-map.csv');
const outPath = join(here, 'src', 'index.js');

const rows = readFileSync(csvPath, 'utf-8').trim().split('\n').slice(1);
const map = Object.fromEntries(
	rows.map((line) => {
		const [oldUrl, newUrl] = line.split(',');
		return [oldUrl, newUrl];
	}),
);

const source = `// AUTO-GENERATED from redirects/redirect-map.csv by redirects/generate.mjs.
// Do not hand-edit. Run \`npm run redirects:generate\` after editing the CSV.

const REDIRECT_MAP = ${JSON.stringify(map, null, 2)};

const APEX = 'https://hungovercoders.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const newPath = REDIRECT_MAP[url.pathname];

    if (newPath) {
      const target = new URL(newPath, APEX);
      target.search = url.search;
      return Response.redirect(target.toString(), 301);
    }

    return Response.redirect(APEX + '/', 301);
  },
};
`;

writeFileSync(outPath, source);
console.log(`Wrote ${Object.keys(map).length} redirects to ${outPath}`);
