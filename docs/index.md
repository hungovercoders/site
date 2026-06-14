# Documentation Index

This file is **the map** — every other entry point in the repo defers to it.
[`README.md`](../README.md) tells humans what the site is and how to run it locally;
[`AGENTS.md`](../AGENTS.md) is the standard front door for any automation tool;
[`CLAUDE.md`](../CLAUDE.md) imports `AGENTS.md` for Claude Code.
All three keep themselves thin and point here when detail is needed.

| Category | Purpose | README |
| -------- | ------- | ------ |
| [architecture/](architecture/) | How the site is structured — components, content collections, the training-repos wiring | [README](architecture/README.md) |
| [content/](content/) | What this repo produces — blog posts, training lessons, projects | [README](content/README.md) |
| [deployment/](deployment/) | How it ships — Cloudflare Workers Builds, DNS, the `dist/client` gotcha | [README](deployment/README.md) |
| [operations/](operations/) | Pipeline gates, runbooks, common slopstopper failures | [README](operations/README.md) |
| [security/](security/) | Headers baseline, per-path CSP relaxations, secrets allowlist | [README](security/README.md) |

The [`ss:hygiene:docs-structure`](../Taskfile.ss.yml) check enforces this map: every directory listed
in the table above must have a matching `README.md`, and every directory inside `docs/` must
appear in the table. Add a category here before adding its directory.
