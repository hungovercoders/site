# site — agent context

## What this repo is

The public-facing site at `hungovercoders.com` (apex 301s to `www.hungovercoders.com`). Built with Astro, deployed to Cloudflare Workers via the `@astrojs/cloudflare` adapter. Serves blog posts from `src/content/blog/` and training lessons sourced from sibling `learn.*` repos.

## Repo layout

```
src/content.config.ts   content collections: blog + training
src/pages/              routes — blog/[...slug].astro, training/[series]/[lesson].astro
src/layouts/            BlogPost.astro, TrainingLesson.astro
src/components/         BaseHead, Header, Footer, Search
scripts/
  fetch-training-repos.sh   CI: shallow-clones learn.* repos into training-repos/
  link-local-repos.sh       local dev: symlinks sibling learn.* repos into training-repos/
training-repos/             gitignored — populated by one of the two scripts above
```

## Training content — how it works

Lesson markdown lives canonically in the `learn.*` tutorial repos (e.g. `learn.bento/content/*.md`). The Astro glob loader reads from `training-repos/` at build time. The `training-repos/` directory is never committed.

- **CI / Cloudflare Workers**: `npm run build` runs `fetch-training-repos.sh` first, which shallow-clones each repo listed in the script.
- **Local dev**: run `./scripts/link-local-repos.sh` once after cloning. It auto-discovers every `learn.*` sibling directory and symlinks it into `training-repos/`. Edit lesson markdown locally and changes appear immediately in `npm run dev`.

## Local dev setup (first time)

```bash
git clone https://github.com/hungovercoders/site.git
cd site
npm install
./scripts/link-local-repos.sh   # requires learn.* repos to be cloned as siblings
npm run dev
```

## Adding a new training series

1. Create the `learn.<topic>` repo following the `content/` + `examples/` layout (see that repo's `AGENTS.md`)
2. Add `"learn.<topic>"` to the `REPOS` array in `scripts/fetch-training-repos.sh`
3. `link-local-repos.sh` picks it up automatically for local dev (no change needed)

## Conventions

- Blog posts live in `src/content/blog/` with pattern `YYYY-MM-DD-slug.md`
- Training lessons require frontmatter: `title`, `series`, `order`, `description`, `canonical_url`
- YAML / Astro files use tab indentation
- CSS is scoped per-component with `<style>` blocks; breakpoint is 720px

## Deploy — Cloudflare Workers + the `dist/client` gotcha

The site deploys via Cloudflare Workers (`@astrojs/cloudflare` adapter). The worker is named `site` (config in `wrangler.jsonc`) and exposes the deployment at `site.griff182uk.workers.dev`, custom-bound to `hungovercoders.com` + `www.hungovercoders.com`. CF dashboard build settings: build cmd `npm run build`, deploy cmd `npx wrangler deploy`, production branch `main`. DNS is hosted at Namecheap (nameservers `dns1/2.registrar-servers.com`) with A records pointing at Cloudflare anycast IPs — so DNS record changes happen at Namecheap, not in the Cloudflare dashboard.

**The gotcha that will bite you:** the adapter splits the build into

- `dist/client/` — static assets that wrangler uploads via the `ASSETS` binding (this is the public web root)
- `dist/server/` — the worker bundle

Anything written into `dist/` *outside* `dist/client/` is **not deployed**. This caught us once with pagefind: `pagefind --site dist` wrote `dist/pagefind/`, local builds served it fine, production 404'd silently. The fix was `pagefind --site dist/client`.

For any post-`astro build` step that produces static assets (search indexes, redirect files, sitemap appenders, generated images), the output path must live under `dist/client/`. When debugging a "works locally, 404 in prod" asset, check the wrangler deploy log for `Read N files from .../dist/client` — that's the upload root.

## Analytics + cookie consent

Google Tag Manager (`GTM-P74Q3WN`, configured in `src/consts.ts`) is loaded on every page via `BaseHead.astro` (head script) and a shared `GtmNoscript` component (body iframe). This is the hungovercoders.com container — distinct from the legacy datagriff Jekyll container (`GTM-5RJBJWL`).

**Don't add a cookie consent library to the site code.** Consent is served as a klaro tag *inside* the GTM container — loading GTM is what triggers the banner. Adding `klaro` or `cookieconsent` to the Astro source would double up. If consent behaviour needs changing, it changes inside the GTM container, not in this repo.

## Per-post share images (Open Graph)

Blog frontmatter takes an optional `image.path` (Jekyll-style nesting, e.g. `image: { path: /assets/<slug>/link.png }`). `BaseHead.astro` URL-resolves it against `astro.config.mjs`'s `site` and emits absolute `og:image` / `twitter:image` tags. `og:type` is `article` for blog posts, `website` for everything else.

Use `scripts/generate-share-image.mjs <slug> "<title>" "<tagline>"` to produce a branded 1200×630 PNG at `public/assets/<slug>/link.png`. The `hc-launch` skill runs this automatically; for ad-hoc posts, invoke it manually. Verify after deploy at `https://metatags.io/`.
