# Deployment

The site deploys to **Cloudflare Workers via Workers Builds**. Git integration is configured
in the Cloudflare dashboard; no GitHub Actions workflow is involved.

## How it ships

- **Pushes to `main`** deploy to production at `https://hungovercoders.com`.
- **Pull requests** get a preview URL at `https://<branch>.site.griff182uk.workers.dev`. The
  preview is rebuilt on every push to the branch; closing the PR cleans it up.
- **No secrets dance** — Cloudflare reads from the connected Git repo directly. No
  `CLOUDFLARE_API_TOKEN` in GitHub Secrets.

## DNS

- Apex `hungovercoders.com` and `www.hungovercoders.com` both point at Cloudflare; the apex
  301s to `www`.
- DNS is managed at **Namecheap** (registrar) with nameservers delegated to Cloudflare.
- The `blog.hungovercoders.com` subdomain has a separate Worker
  ([`blog-redirect-worker`](https://github.com/hungovercoders/blog-redirect-worker)) that 301s
  every path on `blog.hungovercoders.com/*` to the apex `/blog/*` — kept for inbound links
  from the pre-magazine-style era.

## The `dist/client` gotcha

`@astrojs/cloudflare` builds into `dist/`, splitting output into two trees:

- `dist/client/` — static assets that ship to the Worker's static asset cache.
- `dist/server/` — the Worker bundle (the SSR runtime).

**Anything written outside `dist/client/` at build time is not deployed.** Common ways to
trip this:

- Custom build steps that drop files into `public/` after `astro build` — those won't make it
  out unless they go to `dist/client/` directly.
- Scripts that read `dist/sitemap.xml` (which doesn't exist — the sitemap is at
  `dist/client/sitemap-index.xml`).

The slopstopper reliability checks know to look in `dist/client/` for the local-build path
(`slopstopper serve` runs the bundled static server on `:8080` against that directory).

## Cookie consent

Cookie consent uses [Klaro](https://klaro.org/), loaded inside the GTM container so consent
state flows naturally to GA4 / Tag Manager events. Configuration lives in the GTM workspace
(not in this repo); see the project's GTM tag setup if you need to add a new vendor.
