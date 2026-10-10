# site — agent context

Open standard for agents, AI assistants and automation tools working in this repo. Conformant with [agents.md](https://agents.md). `CLAUDE.md` is a one-line `@AGENTS.md` include, so this file is the single working layer for every agent.

## What this repo is

The public-facing site at `hungovercoders.com`. The apex is the canonical host, served directly (`www.hungovercoders.com` also resolves but is not canonical). Built with Astro + `@astrojs/cloudflare`, deployed to Cloudflare Workers via Workers Builds. Serves blog posts from `src/content/blog/`, projects from `src/content/projects/`, and training lessons sourced from sibling `learn.*` repos at build time. Quality pipeline by [slopstopper](https://slopstopper.dev).

## Routes

| When you are changing… | Do this |
| ---------------------- | ------- |
| Blog posts, training lessons, project entries — frontmatter, slugs, share images | Read [`docs/content/README.md`](./docs/content/README.md) for the frontmatter schemas and authoring rules |
| Site structure — components, layouts, Astro content collections, training-repo wiring | Read [`docs/architecture/README.md`](./docs/architecture/README.md) for the stack, repo layout and routing |
| Deploy — Cloudflare Workers Builds, DNS at Namecheap, the `dist/client` gotcha, analytics | Read [`docs/deployment/README.md`](./docs/deployment/README.md) for the deploy model and its gotchas |
| Pipeline gates, runbooks, slopstopper checks, common failures | Read [`docs/operations/README.md`](./docs/operations/README.md) for the local check commands and runbooks |
| Security headers, CSP, DAST exceptions | Read [`docs/security/README.md`](./docs/security/README.md) for the header policy and DAST allowlist |

For any task not covered above, read [`docs/README.md`](./docs/README.md) for the routing table for every doc in this repo.

## Conventions worth knowing up front

- **YAML / Astro files use tab indentation.** Markdown frontmatter is YAML and follows the same rule.
- **CSS is scoped per-component** with `<style>` blocks; mobile breakpoint is 720px.
- **British English** in all prose. `description` frontmatter has no trailing period.
- **Blog post slugs** follow `YYYY-MM-DD-<slug>.md` (enforced by the Astro content collection glob in `src/content.config.ts`).
- **Training repos are not committed** here. `training-repos/` is gitignored and populated by `scripts/fetch-training-repos.sh` (CI) or `scripts/link-local-repos.sh` (local).
- **Share images live under `public/`.** Anything written outside `dist/client/` at build time is not deployed.
- **Docs layout is enforced.** `task ss:hygiene:test` checks the token budgets on `AGENTS.md` / `README.md` / `docs/README.md` and that every doc under `docs/` has an explicit route.
