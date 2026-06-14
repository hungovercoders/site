---
title: "Adding slopstopper to hungovercoders"
date: 2026-06-14
author: dataGriff
description: "I wanted quality gates on this site that I didn't have to maintain — something that'd tell me a regression was coming before a reader noticed. Installing slopstopper took one curl pipe and a Sunday's worth of triage; the seven gaps that surfaced are now fixed for everyone"
tags:
- slopstopper
- ai
- devops
- claude-code
- cloudflare
- hungovercoders
image:
  path: /assets/2026-06-14-adding-packaged-slopstopper-to-hungovercoders/link.png
---

I wanted quality gates on this site that I didn't have to maintain. Something that would tell me — before a reader noticed — if a deploy regressed accessibility, if a dependency went CVE-shaped, if a docs page started lying about a file that no longer existed. Something portable enough that whatever I built next would inherit the same gates without re-thinking. That tool is [slopstopper](https://slopstopper.dev), and this is the path through installing it on hungovercoders.

This post is dataGriff's path through slopstopper on a real Astro + Cloudflare Workers site — opinionated, hands-on, slightly hungover. The canonical reference is [slopstopper.dev](https://slopstopper.dev); use this alongside it, not instead. Going first on a real, non-trivial adopter also surfaced seven things the suite's own repo couldn't have caught — all seven are fixed in `slopstopper-cli 0.5.1` and listed near the end of this post. Adopter number two inherits them.

## What You Get for One Curl Pipe

Five feedback loops, all wired up by the install, all running on every PR.

| Loop | What it does | Tools under the hood |
| --- | --- | --- |
| 🔒 **Security** | SAST, DAST, secrets, dependency CVEs, dependency review | Semgrep, OWASP ZAP, Gitleaks, Trivy |
| 🧹 **Hygiene** | Complexity caps, doc structure / accuracy / size, entry-file budget, CSP drift, auto-label PRs, markdown lint | Lizard, custom Python, actions/labeler |
| ✅ **Reliability** | Smoke, accessibility (WCAG 2.1 AA), Core Web Vitals, SEO + OpenGraph, broken links | Playwright, axe-core, Lighthouse CI |
| 🤖 **Operations** | Failed workflows auto-raise issues; an agentic doc updater opens weekly sync PRs | GitHub Actions, gh-aw |
| 🚀 **Deployment** | Preview deploys per PR, prod releases, preview cleanup | Cloudflare Workers Builds |

The shape that makes this manageable: the actual check logic lives inside a Python package on PyPI (`slopstopper-cli`), not copied into your repo. Your repo gets two things — a `.slopstopper.yml` config and twenty thin `ss-*.yml` GitHub Actions workflows. The workflows call into the CLI; the CLI runs the checks; reports land in `.ss/reports/`. When slopstopper ships a check fix, every adopter picks it up on the next `pipx upgrade slopstopper-cli` — no workflow copy, no script vendoring, no pinned-wheel-URL bump.

## Pre-Requisites

- A repo you'd like to add quality gates to
- A terminal with `curl` and Python 3
- [pipx](https://pipx.pypa.io/) — strongly preferred over `pip install --user` (cleaner, isolates each tool's venv)
- Optional: [Task runner](https://taskfile.dev) for the local `task ss:*` shims
- Optional: [Claude Code](https://claude.com/claude-code) — the `slopstopper-install` skill drives the whole install end-to-end and catches the gotchas before they bite

## Cracking Open the Tap

The whole install is one line:

```bash
curl -fsSL https://raw.githubusercontent.com/hungovercoders/slopstopper/main/install.sh | bash
```

If you want to read the script first — which is the sensible move when you're about to drop twenty workflows into a repo — review it then run `bash install.sh` locally instead of piping curl directly into bash. The install does three things: installs (or upgrades) `slopstopper-cli` via `pipx`, drops the twenty `ss-*.yml` workflows into `.github/workflows/`, and seeds the templates that turn an opted-out repo into an opted-in one (`.slopstopper.yml`, `.github/labeler.yml`, `public/_headers` security baseline, `.zap/rules.tsv`, `.markdownlint.json`).

![the slopstopper-install skill's pre-flight summary — twelve anticipatory checks confirming the repo is ready before any install action runs](/assets/2026-06-14-adding-packaged-slopstopper-to-hungovercoders/step-01-preflight.png)

![install.sh's final output — twenty workflows refreshed, slopstopper-cli 0.5.1 on PATH, and the seeded templates per the post-install matrix](/assets/2026-06-14-adding-packaged-slopstopper-to-hungovercoders/step-02-install-output.png)

The headline feature of the packaged distribution is that the adopter footprint is genuinely small. After install you have two things under `.ss/`:

```text
.ss/
├── .workflows-installed   # install manifest (must be committed)
└── reports/               # gitignored output dir
```

That's it. Every Playwright spec, every lighthouserc, the static `server.js` shim, the per-check Python logic — all of it lives inside the wheel and resolves at runtime. If you genuinely need to customise something, `slopstopper templates eject <name>` copies the bundled file into `.ss/<name>` and the resolver prefers your override on the next run.

![ls -la .ss/ after install — just .workflows-installed and reports/, plus the slopstopper --version line confirming 0.5.1 on PATH](/assets/2026-06-14-adding-packaged-slopstopper-to-hungovercoders/step-03-tiny-ss-dir.png)

## Pouring the Settings In

Configuration lives in `.slopstopper.yml`. The fields that matter on a Cloudflare-deployed Astro site:

```yaml
node_version: '22'              # match your package.json engines.node

headers:
  source: public/_headers       # Cloudflare/Netlify native format
  format: cloudflare-text

urls:
  production: https://hungovercoders.com
  preview:    https://site.griff182uk.workers.dev

pages:
  smoke:         /,/about,/blog,/training,/projects
  accessibility: /,/about,/blog,/training,/projects
  seo:           /,/about,/blog,/training,/projects
  broken_links:  /,/about,/blog,/training,/projects

smoke:
  og_image_path: ''               # this site uses per-post share images
```

Plus one GitHub repo variable so the workflows pick up the right Node version when they run:

```bash
gh variable set SLOPSTOPPER_NODE_VERSION --body 22
```

That's the whole configuration. Two new CLI verbs are worth knowing before you run anything:

- `slopstopper doctor` — verifies every external binary the suite needs (node, gh, semgrep, gitleaks, trivy, docker) is installed and reports versions. Replaces the "scroll up and grep for missing tool" pattern.
- `slopstopper templates {list,path,eject}` — inspect or override bundled files. `list` shows what's bundled vs ejected; `eject` copies a bundled file into `.ss/<name>` for editing.

I'll be honest — the doctor command is the one I reach for most. When a check fails the first question is always "is the tool even installed?" and doctor answers in two seconds.

![slopstopper doctor output — six external tools (node, gh, semgrep, gitleaks, trivy, docker) all found, all required tools available](/assets/2026-06-14-adding-packaged-slopstopper-to-hungovercoders/step-04-doctor.png)

## Two Rounds Before the Push

Every check has both a CI workflow and a local `task ss:*` shim. The local-first loop is the spine of a good install — fix locally, push only when green. CI then confirms what you already know.

**Pass A** — static checks. No URL needed, no build needed, runs in seconds:

```bash
task ss:hygiene:test         # complexity + docs-* + entry-files + csp-exceptions + lint
task ss:security:secrets     # Gitleaks
task ss:security:sast        # Semgrep
task ss:security:vulnerability:all   # Trivy
```

![task ss:hygiene:test output — nine sub-checks all green, including complexity (CCN ≤ 10), docs-structure (Map Pattern table matches directory tree), and the entry-file budget cap](/assets/2026-06-14-adding-packaged-slopstopper-to-hungovercoders/step-05-pass-a-green.png)

**Pass B** — dynamic checks. Need a built site and a URL. The bundled `slopstopper serve` is the local engine — it auto-detects your build output directory, picks up `public/_headers` natively for security-header validation, and listens on 8080:

```bash
npm run build
slopstopper serve &
SMOKE_TEST_URL=http://localhost:8080         task ss:reliability:smoke
ACCESSIBILITY_TEST_URL=http://localhost:8080 task ss:reliability:accessibility
SEO_TEST_URL=http://localhost:8080           task ss:reliability:seo
BROKEN_LINKS_TEST_URL=http://localhost:8080  task ss:reliability:links
CWV_URL=http://localhost:8080                task ss:reliability:cwv
DAST_TEST_URL=http://localhost:8080          task ss:security:dast    # heaviest; needs Docker
```

![task ss:reliability:smoke green against localhost:8080 — five pages, all returning 200, all loading their expected critical content](/assets/2026-06-14-adding-packaged-slopstopper-to-hungovercoders/step-06-pass-b-green.png)

Only when both passes are clean do you push. At that point CI is confirmation, not discovery.

## What the First Real Install Found

First adopter installs are where you find out which "obviously working" code paths are obviously working only on the tool's own repo. Going through the install on a non-trivial real site surfaced seven things — most of them the kind of failure that's silent on the tool's own infrastructure but loud and confusing on a different shape of project. All seven are fixed in `slopstopper-cli 0.5.1`. Every adopter from here inherits the fix.

1. **install.sh wasn't honest about its own pipx outcomes.** Errors from `pipx upgrade` got swallowed by a stray `2>/dev/null` and the success message reported whatever stale build was already installed. Fixed in 0.5.1 — failures surface and the post-install line warns when the version didn't move.
2. **A stale `.ss/.workflows-installed` could silently install zero workflows.** Leftover marker files from prior branches looked indistinguishable from a deliberate "I deleted all twenty workflows" choice. Fixed in 0.5.1 — install detects the implausible state (full marker, zero workflows on disk) and re-installs fresh with a loud warning.
3. **Existing `public/_headers` with cache-only rules never got the security baseline.** The `seed_template` step bailed on any file that already existed. Fixed in 0.5.1 — the security headers block is now appended idempotently, bracketed by begin/end markers, leaving adopter content untouched.
4. **`hygiene:complexity` failed because `lizard` wasn't in the pipx venv.** And `slopstopper doctor` cheerfully reported `lizard found at /opt/homebrew/bin/lizard` — but that's `lz4`'s lizard, an unrelated tool. Fixed in 0.5.1 — `lizard` is a runtime dependency of `slopstopper-cli`, always lives in the same venv, and doctor no longer pretends the brew binary is the real one.
5. **The bundled Playwright config couldn't resolve `@playwright/test` from inside the pipx venv.** Smoke/accessibility/broken-links all failed with `MODULE_NOT_FOUND` because Playwright's import resolution started inside the wheel's path, where no `node_modules` exists. Fixed in 0.5.1 — the reliability checks auto-eject the config + their spec into `.ss/` (where the adopter's `node_modules` is reachable) on first run.
6. **`slopstopper serve` only parsed `worker/headers.json` (slopstopper.dev's own shape).** Adopters on Cloudflare / Netlify — the most common case — had to maintain a parallel JSON file just to give the local DAST scan something to inspect. Fixed in 0.5.1 — `slopstopper serve` now parses Cloudflare's native `_headers` text format and auto-detects `public/_headers` by default.
7. **The vulnerability check disagreed with its own CI workflow about what counted as blocking.** Local `task ss:security:vulnerability:all` exited 0 on CRITICAL/HIGH findings; the CI workflow then ran a separate post-processing step that exited 1. Green locally, red in CI, on the same scan. Fixed in 0.5.1 — the check itself exits non-zero on HIGH+ and the redundant CI gate step is gone.

The point of going first is that someone has to. Slopstopper is now a better tool because hungovercoders was the first non-slopstopper.dev adopter; everyone who installs it from this point gets the install I wish I'd had.

## Eighteen Green

After the local-first loop went clean I pushed the branch and watched the GitHub Actions matrix spin up. The full picture is what every PR on this repo now produces:

![the slopstopper PR checks page on GitHub — eighteen of eighteen ss-* workflows green plus the Cloudflare Workers Builds preview](/assets/2026-06-14-adding-packaged-slopstopper-to-hungovercoders/step-07-pr-checks.png)

The check matrix maps one-to-one onto the five loops table above. Anything in the security or hygiene loop runs on every PR. The reliability loop runs against the Cloudflare preview URL (created by Workers Builds, deleted when the PR closes) so the dynamic checks audit the *actual deploy* this PR will produce — not a synthetic build artefact. SEO checks confirm `og:image` resolves and `canonical` points where it should. Broken-links walks the page graph. DAST runs OWASP ZAP against the preview. CWV runs Lighthouse with the prod-tier asserts because the preview is built the same way prod is.

## Would I Add Another One Tomorrow

Yes, and I will. The local-first loop is the part that surprises me most often — `task ss:hygiene:test` plus `task ss:reliability:smoke` runs more often than `git status` on this repo, because the cost of running them is small and the cost of pushing red is non-zero. The per-PR check matrix has become the thing I look at first when something feels off on the site, before the deploy logs or the analytics dashboard. The five loops above are the surface area; the real value is that none of them maintain themselves and none of them need me to remember what to run.

The one honest caveat — install it on something real and report what bites. Slopstopper got measurably better in the four hours between starting this install and writing this post, because going through the install on a non-trivial repo found seven things the tool's own self-install couldn't have. The next adopter's install will find a different seven; that's the gig. The skill chain (`slopstopper-install` for the install itself, `slopstopper-triage` for when a check goes red) closes most of the gap, but the part where a real adopter says "this didn't work on my shape of project" is the part that makes the suite portable in the way it claims to be.

Well done on adding your quality gates, fellow hungovercoder. Go pour a [tiny-ipa](https://tinyrebel.co.uk/) and watch your PRs glow green. The seven findings above are now permanently part of the install — adopter number two doesn't have to find them.

Cheers.
