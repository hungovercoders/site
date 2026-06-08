# hungovercoders

The public-facing site at [hungovercoders.com](https://www.hungovercoders.com). Astro + `@astrojs/cloudflare`, deployed to Cloudflare Workers via Workers Builds. Serves blog posts from `src/content/blog/` and training lessons sourced from sibling `learn.*` repos. Quality pipeline by [slopstopper](https://slopstopper.dev/).

## Pipeline status

[![slopstopper](https://img.shields.io/badge/quality-slopstopper-2c7be5?style=flat-square)](https://slopstopper.dev/)

### 🔒 Security
[![SAST](https://github.com/hungovercoders/site/actions/workflows/ss-security-sast-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-sast-check.yml)
[![Secrets](https://github.com/hungovercoders/site/actions/workflows/ss-security-secrets-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-secrets-check.yml)
[![Dependency CVEs](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-all-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-security-vulnerability-all-check.yml)

### 🧹 Hygiene
[![Complexity](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-complexity-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-complexity-check.yml)
[![Docs Accuracy](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-accuracy-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-accuracy-check.yml)
[![Docs Size](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-size-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-size-check.yml)
[![Docs Structure](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-structure-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-docs-structure-check.yml)
[![Auto Label PRs](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-auto-label-pr.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-auto-label-pr.yml)

### ✅ Reliability
[![Playwright](https://github.com/hungovercoders/site/actions/workflows/ss-playwright-tests.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-playwright-tests.yml)
[![Smoke Tests](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-smoke-tests.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-smoke-tests.yml)
[![Accessibility](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-accessibility-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-accessibility-check.yml)
[![Core Web Vitals](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-core-web-vitals.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-core-web-vitals.yml)
[![SEO Metatags](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-seo-check.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-reliability-seo-check.yml)

### 🤖 Operational
[![Doc Auto-Updater](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-doc-updater.lock.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-hygiene-doc-updater.lock.yml)
[![Failure Alerts](https://github.com/hungovercoders/site/actions/workflows/ss-workflow-failure-issue.yml/badge.svg?branch=main)](https://github.com/hungovercoders/site/actions/workflows/ss-workflow-failure-issue.yml)

### 🚀 Deployment
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fwww.hungovercoders.com&label=hungovercoders.com&up_message=up&down_message=down)](https://www.hungovercoders.com/)

Deployed via [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/) — every push to `main` deploys, every PR gets a preview URL as a commit check, closing a PR retires the preview.

## Project structure

```text
src/
  components/        Astro components (BaseHead, Header, Footer, Search)
  content/blog/      Blog posts — pattern: YYYY-MM-DD-slug.md
  content/projects/  Live project entries (e.g. slopstopper)
  layouts/           BlogPost.astro, TrainingLesson.astro
  pages/             Routes (blog, training, about, projects)
  styles/global.css
public/              Static assets (favicons, share images per post)
scripts/             fetch-training-repos.sh, generate-share-image.mjs, …
training-repos/      Gitignored — populated at build by fetch-training-repos.sh
.ss/                 Slopstopper analysis scripts + Playwright tests
.github/workflows/   ss-*.yml (slopstopper) + repo-specific workflows
```

See [`AGENTS.md`](./AGENTS.md) for deploy notes and conventions, and the [hungovercoders/learn.*](https://github.com/hungovercoders) sibling repos for training content sources.

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
