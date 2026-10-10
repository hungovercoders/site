# hungovercoders

The public-facing site at [hungovercoders.com](https://hungovercoders.com). Astro + `@astrojs/cloudflare`, deployed to Cloudflare Workers via Workers Builds. Serves blog posts from `src/content/blog/` and training lessons sourced from sibling `learn.*` repos.

[![Site](https://img.shields.io/website?url=https%3A%2F%2Fhungovercoders.com&label=hungovercoders.com&up_message=up&down_message=down)](https://hungovercoders.com/)

## Deployment

Deployed via [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/) — every push to `main` deploys, every PR gets a preview URL as a commit check, closing a PR retires the preview.

## Project structure

Before you change components, layouts or content collections, read [`docs/architecture/README.md`](./docs/architecture/README.md) for the repo layout and routing.

For any task not covered above, read [`docs/README.md`](./docs/README.md) for the routing table for every doc in this repo.

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build the production site to `./dist/`           |
| `npm run preview`         | Preview your build locally before deploying      |
| `npm run deploy`          | Build + deploy to Cloudflare Workers via wrangler |
| `task --list`             | List all slopstopper checks (`task ss:*:*`)      |
| `npm test`                | Run Playwright smoke + accessibility specs        |

## Credit

Started from the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/) theme.

---

## Quality pipeline (add-on)

Quality gates are provided by [slopstopper](https://slopstopper.dev/) — a portable suite of GitHub Actions, layered on top of the site. They run on every PR; the site itself has no dependency on them.

[![slopstopper](https://img.shields.io/badge/quality-slopstopper-2c7be5?style=flat-square)](https://slopstopper.dev/)

### 🔒 Security
[![API Headers](https://github.com/hungovercoders/site/actions/workflows/ss-security-api-headers-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-api-headers-check.yml)
[![DAST](https://github.com/hungovercoders/site/actions/workflows/ss-security-dast-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-dast-check.yml)
[![SAST](https://github.com/hungovercoders/site/actions/workflows/ss-security-sast-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-sast-check.yml)
[![Secrets](https://github.com/hungovercoders/site/actions/workflows/ss-security-secrets-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-secrets-check.yml)
[![Dependency CVEs](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-all-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-all-check.yml)
[![Dependency Review](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-new-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-new-check.yml)

### 🧹 Hygiene
[![Auto-label PRs](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-auto-label-pr.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-auto-label-pr.yml)
[![Complexity](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-complexity-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-complexity-check.yml)
[![CSP Exceptions](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-csp-exceptions-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-csp-exceptions-check.yml)
[![Docs Accuracy](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-accuracy-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-accuracy-check.yml)
[![Docs Size](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-size-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-size-check.yml)
[![Docs Structure](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-structure-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-structure-check.yml)
[![Entry Files](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-entry-files-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-entry-files-check.yml)
[![OpenAPI Drift](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-openapi-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-openapi-check.yml)

### ✅ Reliability
[![Accessibility](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-accessibility-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-accessibility-check.yml)
[![API Health](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-api-health-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-api-health-check.yml)
[![API Latency](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-api-latency-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-api-latency-check.yml)
[![Broken Links](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-broken-links-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-broken-links-check.yml)
[![Core Web Vitals](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-core-web-vitals.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-core-web-vitals.yml)
[![E2E](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-e2e-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-e2e-check.yml)
[![llms.txt](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-llms-txt-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-llms-txt-check.yml)
[![robots.txt](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-robots-txt-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-robots-txt-check.yml)
[![SEO](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-seo-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-seo-check.yml)
[![Sitemap](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-sitemap-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-sitemap-check.yml)
[![Smoke](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-smoke-tests.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-smoke-tests.yml)

### 🤖 Operational
[![Doc Updater](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-doc-updater.lock.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-doc-updater.lock.yml)
[![Workflow Failures](https://github.com/hungovercoders/site/actions/workflows/ss-workflow-failure-issue.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-workflow-failure-issue.yml)
