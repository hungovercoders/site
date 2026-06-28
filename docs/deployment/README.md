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

The apex `hungovercoders.com` is the canonical host and is served directly (200) by the `site` worker. `www.hungovercoders.com` is also custom-bound to the same worker and currently serves directly too, but it is **not** canonical — `astro.config.mjs` (`site: 'https://hungovercoders.com'`), every page's `<link rel="canonical">`, the sitemap, `og:url`, and RSS all point at the apex. There is no apex↔www redirect today (collapsing `www → apex` with a 301 is a tracked follow-up). The separate worker defined in `redirects/wrangler.jsonc` only handles `blog.hungovercoders.com/*` — run `npm run redirects:deploy` to update it.

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

## Cookie consent

Google Tag Manager (`GTM-5RJBJWL`, configured in `src/consts.ts`) is loaded on every page via `BaseHead.astro`. Consent is served as a klaro tag *inside* the GTM container — loading GTM is what triggers the banner. Don't add a cookie consent library to the site code; it would double up.
