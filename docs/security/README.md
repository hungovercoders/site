# Security

How this site handles security headers, Content-Security-Policy, and DAST findings.

## Security headers

All headers are set via Cloudflare's `_headers` file convention at [`public/_headers`](../../public/_headers). The `@astrojs/cloudflare` adapter copies the file to `dist/client/` and the Cloudflare Worker applies the rules per response.

Site-wide defaults under `/*`:

- `Content-Security-Policy` — `default-src 'self'`. The only third-party origins are Cloudflare Web Analytics (`static.cloudflareinsights.com` in `script-src`, `cloudflareinsights.com` in `connect-src`) — a cookieless beacon, no other tracking. `'unsafe-inline'` is kept for `script-src` (Astro emits the theme/TOC/code-copy scripts inline) and `style-src` (Astro injects scoped `<style>` blocks inline). All of these relaxations are documented in [`CSP_EXCEPTIONS.md`](./CSP_EXCEPTIONS.md).
- `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin` (with `/og-image.png` overridden to `cross-origin` so social platforms can embed the share image)
- `Permissions-Policy` — denies geolocation, camera, microphone, and opts out of FLoC/Topics via `interest-cohort=()`
- `Referrer-Policy: strict-origin-when-cross-origin`

The bundled `slopstopper serve` parses `_headers` and applies matching rules per request, so CI tests asserting headers behave identically to the deployed Worker.

## DAST findings policy

The DAST workflow at `.github/workflows/ss-security-dast-check.yml` runs OWASP ZAP via Docker against the locally-served build on every PR. The gate at `task ss:security:dast` blocks the build on any medium-or-high finding *except* CSP findings on paths documented in [`CSP_EXCEPTIONS.md`](./CSP_EXCEPTIONS.md).

Two classes of finding are accepted by design and silenced via the consumer-side ZAP rule allowlist at [`.zap/rules.tsv`](../../.zap/rules.tsv):

- **Sub Resource Integrity Attribute Missing (rule 90003)** — ZAP flags cross-domain scripts for missing `integrity=`. This applies to a couple of older blog posts that embed third-party scripts; the site chrome itself loads no third-party scripts.
- **Source Code Disclosure - SQL (rule 10099)** — false positive on tutorial blog posts that contain SQL code blocks (e.g. Databricks exam prep, Cosmos emulator). ZAP's heuristic matches the SQL syntax and flags the page as if the application were leaking source code.

Both rule entries in `.zap/rules.tsv` carry a `# why` comment so the exception is documented at the point of suppression.

## When you'd extend this

- **New CSP relaxation needed for a page** (e.g. comments widget on a future feedback page): add a per-path `_headers` block, then document the relaxation in [`CSP_EXCEPTIONS.md`](./CSP_EXCEPTIONS.md). The DAST gate consults that file and swallows CSP findings on documented paths only.
- **New ZAP false-positive** to silence: add a rule entry to `.zap/rules.tsv` with a `# why` comment. Keep the list short and justified.
- **New deployed surface** (separate worker, redirect target, etc.): add the headers via that worker's own config; don't try to push them through `public/_headers` since that only covers the Astro-built assets.
