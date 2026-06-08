# Operations

Quality gates, runbooks, and notes on the pipeline that watches this site.

## Quality pipeline

The site uses [slopstopper](https://slopstopper.dev) as its CI quality suite. Every PR and push to `main` runs the badges shown on the [README](../../README.md) — security (SAST, secrets, dependency CVEs), hygiene (complexity, docs, auto-label), reliability (smoke, accessibility, Core Web Vitals, SEO, Playwright), operational (failure tracker, doc auto-updater).

All checks are defined as `task ss:*` targets in `Taskfile.ss.yml` and runnable locally:

```bash
task --list                              # see every available check
task ss:security:secrets                 # gitleaks scan
task ss:hygiene:complexity               # cyclomatic complexity
task ss:hygiene:docs-structure           # validate docs/ tree against this index
task ss:reliability:accessibility -- https://www.hungovercoders.com
```

The Map Pattern documented in [`docs/index.md`](../index.md) is what makes the `docs-accuracy`, `docs-structure`, and `docs-size` workflows meaningful — adding a category means adding a row to the index, creating the directory, dropping in a `README.md`.

## Common runbooks

### "Site is down" alert

1. Check Cloudflare dashboard → Workers → `site` → Logs for runtime errors.
2. Check the most recent push to `main` and the corresponding Workers Builds deploy.
3. If the deploy failed, revert the bad commit or re-deploy from a known-good commit via `npm run deploy` locally.
4. DNS is at Namecheap, not Cloudflare — if the symptom is "DNS doesn't resolve", check there first.

### "Build works locally but assets 404 in prod"

Almost always the `dist/client/` gotcha — see [deployment/](../deployment/README.md). Check the wrangler deploy log for `Read N files from .../dist/client` and confirm the missing asset is under that root, not in `dist/` or `dist/server/`.

### "Slopstopper workflow is failing"

Each failed run posts a PR comment / opens an issue with the report. Look there first. Most reliability checks have both a local-build path (PR/push) and a deployed-URL path (schedule); the local-build path needs `server.js` running on port 8080.

### "Share image is missing on social preview"

1. Confirm the post's frontmatter has an `image.path` pointing under `/assets/<slug>/link.png`.
2. Confirm the file exists at `public/assets/<slug>/link.png` (or regenerate it via `scripts/generate-share-image.mjs`).
3. After deploy, verify with [metatags.io](https://metatags.io/) — it shows what Twitter/Facebook actually pick up.

## Useful references

- Cloudflare dashboard: workers → `site` → Deployments / Logs / Custom domains
- Wrangler CLI: `npx wrangler` from the repo root (configured by `wrangler.jsonc`)
- Cloudflare Workers Builds: dashboard build/deploy history per push
