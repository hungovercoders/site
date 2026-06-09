/**
 * Tiny static server used by slopstopper's PR/push local-build workflows
 * (smoke / accessibility / Core Web Vitals / SEO / Playwright / DAST).
 *
 * Serves `dist/client/` on port 8080 — the path Astro's @astrojs/cloudflare
 * adapter writes static assets to, and the port slopstopper's workflows
 * expect. The Worker bundle in `dist/server/` is ignored by this server;
 * preview deploys and prod go through Cloudflare Workers, not through here.
 *
 * Reads `dist/client/_headers` (Cloudflare's per-path header format) at
 * startup so local CI parity matches what the deployed Worker serves —
 * specifically required for the slopstopper smoke test which asserts
 * `Cross-Origin-Resource-Policy: cross-origin` on `/og-image.png`.
 *
 * Local dev: `npm run dev` (Astro dev server, port 4321) is what you want.
 * `node server.js` is for CI parity only.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.join(__dirname, 'dist', 'client');
const HEADERS_FILE = path.join(ROOT, '_headers');

function parseHeadersFile(filePath) {
	if (!fs.existsSync(filePath)) return [];
	const rules = [];
	let current = null;
	for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
		const line = raw.replace(/\r$/, '');
		if (!line.trim() || line.trim().startsWith('#')) continue;
		if (!line.startsWith(' ') && !line.startsWith('\t')) {
			current = { pattern: line.trim(), headers: {} };
			rules.push(current);
		} else if (current) {
			const idx = line.indexOf(':');
			if (idx > 0) {
				const name = line.slice(0, idx).trim();
				const value = line.slice(idx + 1).trim();
				current.headers[name] = value;
			}
		}
	}
	return rules;
}

const HEADER_RULES = parseHeadersFile(HEADERS_FILE);

function matchesPattern(pattern, urlPath) {
	if (pattern === '/*') return true;
	if (pattern.endsWith('/*')) return urlPath.startsWith(pattern.slice(0, -1));
	return pattern === urlPath;
}

function headersForPath(urlPath) {
	const headers = {};
	for (const rule of HEADER_RULES) {
		if (matchesPattern(rule.pattern, urlPath)) Object.assign(headers, rule.headers);
	}
	return headers;
}

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.txt': 'text/plain; charset=utf-8',
	'.xml': 'application/xml; charset=utf-8',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
};

function resolveFile(urlPath) {
	const decoded = decodeURIComponent(urlPath.split('?')[0]);
	const safe = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
	const candidate = path.join(ROOT, safe);
	if (!candidate.startsWith(ROOT)) return null;
	try {
		const stat = fs.statSync(candidate);
		if (stat.isDirectory()) {
			const idx = path.join(candidate, 'index.html');
			return fs.existsSync(idx) ? idx : null;
		}
		return candidate;
	} catch {
		if (!path.extname(candidate)) {
			const html = candidate + '.html';
			if (fs.existsSync(html)) return html;
		}
		return null;
	}
}

const server = http.createServer((req, res) => {
	const urlPath = (req.url || '/').split('?')[0];
	const extraHeaders = headersForPath(urlPath);
	const file = resolveFile(req.url || '/');
	if (!file) {
		const notFound = path.join(ROOT, '404.html');
		if (fs.existsSync(notFound)) {
			res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders });
			fs.createReadStream(notFound).pipe(res);
			return;
		}
		res.writeHead(404, { 'Content-Type': 'text/plain', ...extraHeaders });
		res.end('Not Found');
		return;
	}
	const ext = path.extname(file).toLowerCase();
	res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', ...extraHeaders });
	fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
	console.log(`server.js serving ${ROOT} on http://localhost:${PORT}`);
});
