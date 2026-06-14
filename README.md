# hungovercoders/site

The public-facing site at [hungovercoders.com](https://hungovercoders.com). Built with
[Astro 6](https://astro.build/) + [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/),
deployed to Cloudflare Workers via Workers Builds. Serves blog posts, tutorial-series
lessons (sourced from sibling `learn.*` repos at build time), and project entries.

For all detail — content authoring, build pipeline, deploy gotchas, runbooks — start at
[**`docs/index.md`**](./docs/index.md). This README, [`AGENTS.md`](./AGENTS.md), and
[`CLAUDE.md`](./CLAUDE.md) are intentionally thin entry points that defer to the map.

## Pipeline status

[![slopstopper](https://img.shields.io/badge/quality-slopstopper-2c7be5?style=flat-square)](https://slopstopper.dev/)

### Security

[![SAST](https://github.com/hungovercoders/site/actions/workflows/ss-security-sast-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-sast-check.yml)
[![Secrets](https://github.com/hungovercoders/site/actions/workflows/ss-security-secrets-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-secrets-check.yml)
[![Dependency CVEs](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-all-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-all-check.yml)
[![Dependency Review](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-new-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-new-check.yml)
[![DAST](https://github.com/hungovercoders/site/actions/workflows/ss-security-dast-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-dast-check.yml)

### Hygiene

[![Complexity](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-complexity-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-complexity-check.yml)
[![CSP exceptions](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-csp-exceptions-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-csp-exceptions-check.yml)
[![Docs accuracy](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-accuracy-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-accuracy-check.yml)
[![Docs size](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-size-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-size-check.yml)
[![Docs structure](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-structure-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-structure-check.yml)
[![Entry files](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-entry-files-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-entry-files-check.yml)
[![Auto-label](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-auto-label-pr.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-auto-label-pr.yml)

### Reliability

[![Smoke](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-smoke-tests.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-smoke-tests.yml)
[![Accessibility](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-accessibility-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-accessibility-check.yml)
[![Core Web Vitals](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-core-web-vitals.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-core-web-vitals.yml)
[![SEO](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-seo-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-seo-check.yml)
[![Broken Links](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-broken-links-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-broken-links-check.yml)

### Operational

[![Workflow failures](https://github.com/hungovercoders/site/actions/workflows/ss-workflow-failure-issue.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-workflow-failure-issue.yml)
[![Doc updater](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-doc-updater.lock.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-doc-updater.lock.yml)

## Local development

```bash
git clone https://github.com/hungovercoders/site.git
cd site
npm install
./scripts/link-local-repos.sh   # optional — symlinks sibling learn.* repos for training pages
npm run dev                     # http://localhost:4321
```

## Local-first quality loop

Every CI check has a `task ss:*` local equivalent. Two passes — see
[`docs/operations/README.md`](./docs/operations/README.md) for the full
walkthrough.

```bash
task ss:hygiene:test                # Pass A: static checks (seconds)
npm run build && slopstopper serve & # then Pass B: dynamic checks
SMOKE_TEST_URL=http://localhost:8080 task ss:reliability:smoke
# (similar for accessibility, seo, links, cwv, dast)
```

## Credit

Pipeline by [slopstopper](https://slopstopper.dev/). Original Astro starter theme by
[Bear Blog](https://github.com/HermanMartinus/bearblog/).
