# site — agent context

Open standard for agents, AI assistants and automation tools working in this repo.
Conformant with [agents.md](https://agents.md).

> 🗺️ **Documentation map.** [`docs/index.md`](./docs/index.md) is the single index of all
> project documentation. This file, [`CLAUDE.md`](./CLAUDE.md) and [`README.md`](./README.md)
> are intentionally thin entry points — they point at the map rather than duplicating its
> content. When you need detail on any topic — the build pipeline, the deploy gotcha,
> content authoring, runbooks — start at [`docs/index.md`](./docs/index.md) and follow its
> links to the category README that owns it. The `ss:hygiene:entry-files` check enforces a
> 1500-word cap on each entry file; the `ss:hygiene:docs-structure` check keeps the map
> honest against the directory tree.

## What this repo is

The public-facing site at `hungovercoders.com` (apex 301s to `www.hungovercoders.com`).
Built with Astro 6 + `@astrojs/cloudflare`, deployed to Cloudflare Workers via Workers
Builds. Serves blog posts from `src/content/blog/`, projects from `src/content/projects/`,
and training lessons sourced from sibling `learn.*` repos at build time. Quality pipeline
by [slopstopper](https://slopstopper.dev) — see
[`docs/operations/README.md`](./docs/operations/README.md).

## Where to look for what

| If you're changing… | Start at |
| ------------------- | -------- |
| Blog posts, training lessons, project entries — frontmatter, slugs, share images | [`docs/content/README.md`](./docs/content/README.md) |
| Site structure — components, layouts, Astro content collections, training-repo wiring | [`docs/architecture/README.md`](./docs/architecture/README.md) |
| Deploy — Cloudflare Workers Builds, DNS at Namecheap, the `dist/client` gotcha, cookie consent | [`docs/deployment/README.md`](./docs/deployment/README.md) |
| Pipeline gates, runbooks, slopstopper checks, common failures | [`docs/operations/README.md`](./docs/operations/README.md) |
| Response headers, CSP exceptions, secrets allowlist, DAST suppressions | [`docs/security/README.md`](./docs/security/README.md) |

## Conventions worth knowing up front

- **YAML / Astro files use tab indentation.** Markdown frontmatter is YAML and follows the same rule.
- **CSS is scoped per-component** with `<style>` blocks; mobile breakpoint is 720px.
- **British English** in all prose. `description` frontmatter has no trailing period.
- **Blog post slugs** follow `YYYY-MM-DD-<slug>.md` (enforced by the Astro content collection glob in `src/content.config.ts`).
- **Training repos are not committed** here. `training-repos/` is gitignored and populated by `scripts/fetch-training-repos.sh` (CI) or `scripts/link-local-repos.sh` (local).
- **Share images live under `public/`.** Anything written outside `dist/client/` at build time is not deployed — see [`docs/deployment/README.md`](./docs/deployment/README.md).
