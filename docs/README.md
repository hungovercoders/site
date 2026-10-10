# Documentation Index

This file is **the map** — every other entry point in the repo defers to it.

The three thin entry-point files at the repo root — [`README.md`](../README.md) (humans), [`AGENTS.md`](../AGENTS.md) (automation tools) and [`CLAUDE.md`](../CLAUDE.md) (Claude Code) — point at this index rather than duplicating documentation inline. Each entry file is capped at <2000 words by [`task ss:hygiene:entry-files`](../Taskfile.ss.yml); detail lives below.

## Documentation Categories

Each category has a README that defines its purpose. Content within categories evolves with the site.

| Category | Purpose | README |
| -------- | ------- | ------ |
| [architecture/](architecture/) | How the site is built — Astro, content collections, training-repo wiring | [README](architecture/README.md) |
| [content/](content/) | Authoring blog posts, training lessons and project entries | [README](content/README.md) |
| [deployment/](deployment/) | Cloudflare Workers Builds, DNS, the `dist/client` gotcha | [README](deployment/README.md) |
| [operations/](operations/) | Pipeline gates, runbooks, slopstopper notes | [README](operations/README.md) |
| [security/](security/) | Security headers, CSP, DAST exceptions, false-positive rule allowlist | [README](security/README.md) |

## Governance Model

**This index is the sole source of truth for documentation structure.** The directory tree must conform to this index — not the reverse. The [hygiene docs-structure check](../Taskfile.ss.yml) fails the build if `docs/` drifts from the table above, and the [docs-accuracy check](../Taskfile.ss.yml) catches broken cross-references in any doc.

To add a new category: add a row to the table above, create `docs/<category>/`, drop in a `README.md`. The check will pass on the next run.
