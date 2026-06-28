# CSP exceptions

This file is the **single source of truth** for every per-path Content-Security-Policy relaxation on the hungovercoders site. The slopstopper DAST gate (`task ss:security:dast`) reads this file and swallows CSP findings whose URL path appears under `## Exceptions` below. Non-CSP findings and undocumented paths still block.

## Why this exists

The site ships a tight CSP (`default-src 'self'`). The only third-party origin it loads is Cloudflare Web Analytics (a cookieless beacon); everything else is first-party. The other relaxations are structural to how Astro emits inline scripts and styles. Where we can't avoid a CSP relaxation — because the framework forces inline scripts/styles, or we load a specific third-party origin — we document it here so the DAST gate can stop blocking on it.

## Baseline relaxations (site-wide CSP)

The site-wide CSP shipped from `public/_headers` includes the relaxations below. Some are flagged by ZAP as Medium-severity findings under plugin 10055. These are baseline policy decisions, not per-path overrides, so they are documented here for reviewers but live outside the per-path `## Exceptions` table that the drift check parses.

- **`script-src 'unsafe-inline'`** — Astro emits small client scripts (the theme/dark-mode toggle, table-of-contents, code-copy) inline rather than as external files. Switching to a nonce-based CSP would require Astro experimental CSP plus runtime nonce propagation on a statically-rendered site, which the adapter doesn't support cleanly today. The only inline scripts are the site's own.
- **`style-src 'unsafe-inline'`** — Astro's component-scoped `<style>` blocks are inlined into each HTML page at build time. Without `'unsafe-inline'` every page's own styling would fail to load. This is structural to how Astro renders scoped CSS.
- **`script-src https://static.cloudflareinsights.com`** — loads the Cloudflare Web Analytics beacon `https://static.cloudflareinsights.com/beacon.min.js` (cookieless, privacy-first). Wired via `src/components/BaseHead.astro` and gated on `CF_BEACON_TOKEN` in `src/consts.ts`; it ships only when that token is set.
- **`connect-src https://cloudflareinsights.com`** — the beacon POSTs aggregate metrics to `cloudflareinsights.com/cdn-cgi/rum`. No other connect origins are allowed.

**Why these are tolerable:**
- The site is a static blog with no user-supplied input rendered into HTML. XSS via untrusted content isn't a vector here — every page is built from markdown the maintainer wrote, then served statically.
- `default-src 'self'` and explicit per-directive allowances mean nothing loads from origins we haven't named. The only named third party is Cloudflare's own analytics edge — no other CDN or hosted dependency can get script into our pages.
- `frame-ancestors 'none'` and `X-Frame-Options: DENY` block clickjacking regardless.

**Approved by:** PR introducing the security headers — see `git log public/_headers`.

**Refresh policy:** the only third-party origins are Cloudflare Web Analytics (`static.cloudflareinsights.com`, `cloudflareinsights.com`). If another is ever added, prefer naming that specific origin in the relevant directive over loosening `'unsafe-inline'`, and document it here.

**Fallback:** none needed — the CSP doesn't block anything that affects the user's experience; it's the relaxations themselves that ZAP flags.

## Exceptions

No per-path CSP overrides currently in force. Add an entry here (with a `### /<path>` heading) the first time the site needs one — the drift check enforces parity between this table and `public/_headers`.
