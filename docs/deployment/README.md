# Deployment

How the site reaches `hungovercoders.com`.

## Cloudflare Workers Builds

The site deploys via Cloudflare Workers (`@astrojs/cloudflare` adapter). The worker is named `site` (config in `wrangler.jsonc`) and exposes the deployment at `site.griff182uk.workers.dev`, custom-bound to `hungovercoders.com` + `www.hungovercoders.com`.

Cloudflare dashboard build settings:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`

Every push to `main` deploys. Every PR gets a preview URL as a commit check. Closing a PR retires the preview. No GitHub Actions deploy workflow exists or is needed.

## DNS

DNS is hosted at **Namecheap** (nameservers `dns1/2.registrar-servers.com`) with A records pointing at Cloudflare anycast IPs. DNS record changes happen at Namecheap, not in the Cloudflare dashboard.

The apex `hungovercoders.com` 301s to `www.hungovercoders.com`. The redirect is handled by a small separate worker defined in `redirects/wrangler.jsonc` — run `npm run redirects:deploy` to update it.

## The `dist/client` gotcha

The `@astrojs/cloudflare` adapter splits the build into:

- `dist/client/` — static assets that wrangler uploads via the `ASSETS` binding (the public web root).
- `dist/server/` — the worker bundle.

**Anything written into `dist/` outside `dist/client/` is not deployed.** This caught us once with Pagefind: `pagefind --site dist` wrote `dist/pagefind/`, local builds served it fine, production 404'd silently. The fix was `pagefind --site dist/client`.

For any post-`astro build` step that produces static assets (search indexes, redirect files, sitemap appenders, generated images), the output path must live under `dist/client/`. When debugging a "works locally, 404 in prod" asset, check the wrangler deploy log for `Read N files from .../dist/client` — that's the upload root.

## Local commands

```bash
npm run dev            # Astro dev server (localhost:4321)
npm run build          # Full build — clears cache, fetches training repos, builds, indexes search
npm run preview        # Build + wrangler dev — closer to prod
npm run deploy         # Build + wrangler deploy (you rarely need this; CFB handles it)
```

## Analytics and cookies

There are none. The site loads no analytics, no tag manager, and no third-party scripts, and sets no cookies — so there is no cookie-consent banner to maintain. If a privacy-friendly traffic measure is added later, prefer a cookieless one (no consent banner needed) and document it in [`docs/security/CSP_EXCEPTIONS.md`](../security/CSP_EXCEPTIONS.md) and the [`/privacy`](../../src/pages/privacy.astro) page.
