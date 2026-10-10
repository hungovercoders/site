# Documentation map

The fallback routing table. `AGENTS.md` routes the common tasks directly; use this when a task isn't covered there. Every doc under `docs/` must be reachable from here (or from a category README), and `task ss:hygiene:docs-structure` fails the build when one isn't.

| When you are… | Do this |
| ------------- | ------- |
| Changing how the site is built — Astro, content collections, routing, training-repo wiring | Read [architecture/README.md](architecture/README.md) for the stack, repo layout and routes |
| Authoring blog posts, training lessons or project entries | Read [content/README.md](content/README.md) for the frontmatter schemas and share-image steps |
| Changing deploy, DNS, analytics, or chasing a "works locally, 404 in prod" asset | Read [deployment/README.md](deployment/README.md) for Workers Builds, Namecheap DNS and the `dist/client` gotcha |
| Running pipeline checks, triaging a failing slopstopper workflow, or following a runbook | Read [operations/README.md](operations/README.md) for the local check commands and runbooks |
| Changing security headers, CSP, or the DAST allowlist | Read [security/README.md](security/README.md) for the header policy and ZAP exceptions |
| Adding or relaxing a per-path CSP rule | Read [security/CSP_EXCEPTIONS.md](security/CSP_EXCEPTIONS.md) for every documented relaxation and why |

To add a doc: create it under a category, then add a trigger-first row here or in that category's README.
