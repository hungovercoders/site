# Operations

The site is gated by [slopstopper](https://slopstopper.dev/) — a portable suite of GitHub
Actions, Task targets, and analysis scripts that runs on every PR and every push to `main`.
The full check list is in [`Taskfile.ss.yml`](../../Taskfile.ss.yml) (local equivalent of
every CI check) and `.github/workflows/ss-*.yml`.

## Five feedback loops

| Loop | What it checks |
| ---- | -------------- |
| 🔒 **Security** | SAST (Semgrep), DAST (OWASP ZAP), secrets (Gitleaks), dependency CVEs (Trivy), dependency review |
| 🧹 **Hygiene** | Complexity caps (Lizard), doc structure / accuracy / size, entry-file budget, CSP drift, auto-label PRs, markdown lint |
| ✅ **Reliability** | Smoke (Playwright), accessibility (axe-core), Core Web Vitals (Lighthouse), SEO + OpenGraph, broken links |
| 🤖 **Operations** | Failed workflows auto-raise issues; agentic doc updater opens weekly sync PRs |
| 🚀 **Deployment** | (Outside slopstopper — handled by Cloudflare Workers Builds) |

## Running checks locally

Every check has a `task ss:*` local equivalent. Two passes:

**Pass A — static checks** (no URL needed):

```bash
task ss:hygiene:test         # complexity, docs-*, entry-files, lint, structure, size
task ss:security:secrets     # Gitleaks
task ss:security:sast        # Semgrep
task ss:security:vulnerability:all  # Trivy
```

**Pass B — dynamic checks** (need a built site on `:8080`):

```bash
npm run build
slopstopper serve &
SMOKE_TEST_URL=http://localhost:8080         task ss:reliability:smoke
ACCESSIBILITY_TEST_URL=http://localhost:8080 task ss:reliability:accessibility
SEO_TEST_URL=http://localhost:8080           task ss:reliability:seo
BROKEN_LINKS_TEST_URL=http://localhost:8080  task ss:reliability:links
CWV_URL=http://localhost:8080                task ss:reliability:cwv
DAST_TEST_URL=http://localhost:8080          task ss:security:dast    # needs Docker
```

Run Pass A first (seconds), then Pass B once Pass A is green. The local loop is faster than
push-and-wait-on-CI by an order of magnitude.

## Common failures

| Symptom | Likely cause | Fix lives in |
| ------- | ------------ | ------------ |
| `Dependency review is not supported on this repository` | Dependency Graph disabled at the repo level | GitHub repo Settings → Code security |
| `DAST flagged unsafe-inline / non-cacheable HTML` | GTM bootstrap + intentional HTML revalidation | `.zap/rules.tsv` — add `IGNORE` entry with justification |
| `ss:hygiene:docs-structure` fails on a `docs/` subdirectory | Subdir not listed in `docs/index.md` table | Add a row to the index OR delete the subdir |
| `ss:hygiene:entry-files` over budget | `README.md` / `AGENTS.md` / `CLAUDE.md` exceeded 1500 words | Move detail into `docs/<category>/README.md` |
| `ss:reliability:seo` fails on og:image | `image.path` missing or 404s | Add `image:` block to frontmatter; run `scripts/generate-share-image.mjs` |

For per-check diagnostics use the [`slopstopper-triage`](https://github.com/hungovercoders/library)
skill.
