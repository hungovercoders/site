---
title: "Adding the Packaged Slopstopper to hungovercoders"
date: 2026-06-14
author: dataGriff
description: "A week ago I shipped slopstopper and dropped it on this site. Five days later the whole tool shipped to PyPI as a packaged CLI, the adopter footprint shrank from twenty scripts to nothing, and the install model changed under everyone's feet. This is what reinstalling looked like on a Sunday morning with the dog asleep on the sofa"
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

This blog is a bit of a cheat — it's pretty much the same install I did a week ago, only the suite I'm installing has changed shape under me twice since then. Last Tuesday I shipped [slopstopper](https://slopstopper.dev) and dropped it on this site with a `curl install.sh | bash`. Twenty Python scripts and three Playwright specs landed in `.ss/scripts/` and `.ss/tests/`, all of them in the adopter's tree, all of them moving forward only at the speed of a fresh re-curl. Five days later the whole tool was reborn as a packaged CLI on PyPI, the adopter footprint shrank from "all the check logic" to "a config file and a workflow set", and the install model changed under everyone's feet. Sunday morning, second coffee, dog asleep on the sofa — felt like a good time to drop the original install and reinstall fresh, against the new shape, on the only real adopter slopstopper has so far.

The headline is that the packaged install works. The honest version is that it works after six upstream findings, three of which I would not have caught if I hadn't done this exact dogfood loop — and the second time round, going through the install with the skill watching, the gaps surface in twenty minutes instead of in the next person's afternoon.

## What changed since v0.1

The packaging revamp is one architectural decision and a lot of consequences. The decision: every check tool, every Playwright spec, every lighthouserc config, and the static `server.js` shim now ship inside the `slopstopper-cli` wheel on PyPI. The CLI is the only thing adopters install; the wheel resolves whatever bundled file a check needs at runtime, with a `.ss/` override path for adopters who genuinely need to customise something.

Pre-revamp, an adopter's repo looked like this after installing:

```text
.ss/
├── scripts/           # 14 Python + bash analyzers (~2000 lines)
├── tests/             # 3 Playwright specs
├── lighthouserc.json
├── lighthouserc.prod.json
├── playwright.config.js
server.js              # at the repo root, for the local dev loop
```

Post-revamp, the same repo looks like this:

```text
.ss/
├── .workflows-installed   # install manifest (must be committed)
└── reports/               # gitignored output dir
```

That's it. Everything else is in the wheel. To customise a bundled file you run `slopstopper templates eject <name>` and it lands in `.ss/<name>`; the resolver prefers the override. The workflows still get copied in (`.github/workflows/ss-*.yml`, twenty files), and the Taskfile shims still ship (`Taskfile.ss.yml`), but those are thin wrappers over `slopstopper run <category>:<check>`. The actual logic is one `pipx install slopstopper-cli` away.

The benefit is the boring kind: when slopstopper ships a check fix on PyPI, every adopter picks it up on their next install or `pipx upgrade slopstopper-cli` without a workflow refresh, a script copy, or a pinned-wheel-URL bump across docs. The cost is that every check's local runtime is now a Python venv that doesn't know anything about the adopter's `node_modules` — which turned out to matter (see findings).

Two new CLI verbs are worth knowing:

- `slopstopper doctor` — checks every external binary the suite needs (node, gh, lizard, semgrep, gitleaks, trivy, docker) is installed and reports versions. Replaces the "scroll up and grep for missing tool" pattern I used to use.
- `slopstopper templates {list,path,eject}` — inspect or override bundled files. `slopstopper templates list` tells you what's bundled vs ejected; `eject` copies a bundled file into `.ss/` for editing.

The five feedback loops are unchanged. Same gates, same workflows, same `task ss:*` interface.

| Loop | What it does | Tools under the hood |
| --- | --- | --- |
| 🔒 **Security** | SAST, DAST, secrets, dependency CVEs, dependency review | Semgrep, OWASP ZAP, Gitleaks, Trivy |
| 🧹 **Hygiene** | Complexity caps, doc structure / accuracy / size, entry-file budget, CSP drift, auto-label PRs, markdown lint | Lizard, custom Python, actions/labeler |
| ✅ **Reliability** | Smoke, accessibility (WCAG 2.1 AA), Core Web Vitals, SEO + OpenGraph, broken links | Playwright, axe-core, Lighthouse CI |
| 🤖 **Operations** | Failed workflows auto-raise issues; an agentic doc updater opens weekly sync PRs | GitHub Actions, gh-aw |
| 🚀 **Deployment** | Preview deploys per PR, prod releases, preview cleanup | Cloudflare Workers Builds |

## Pre-Requisites

- A repo you'd like to add quality gates to
- A terminal with `curl` and Python 3
- [pipx](https://pipx.pypa.io/) — strongly preferred over `pip install --user` (cleaner, isolates each tool's venv)
- Optional: [Task runner](https://taskfile.dev) for the local `task ss:*` shims
- Optional: [Claude Code](https://claude.com/claude-code) — the `slopstopper-install` skill drives the whole install end-to-end and catches the gotchas before they bite

## Cracking Open the Reinstall — the Skill Driving

I'm using Claude Code's skill system the same way as last time, only the rolodex has grown a little. The full chain on this install:

- `slopstopper-install` reads the repo, predicts where the install will bite, runs `install.sh`, drives `.slopstopper.yml`, sets up the docs Map Pattern, walks Pass A and Pass B locally before letting me push.
- `slopstopper-triage` handles the per-check diagnostics when a Pass A or Pass B check goes red.
- `hc-screenshot` — new this week — owns the convention for capturing and embedding step-by-step screenshots in posts like this one. Naming (`step-NN-<what>.png`), asset-directory bootstrap (`public/assets/<slug>/`), the macOS `screencapture -W` recipes, the markdown embed snippets. `hc-launch` and `hc-write-lessons` both invoke it.

The reason the third skill landed this week is exactly the reason this post exists: the first install was a story about feedback loops, and I had no good way to *show* you what the install actually looked like. Code blocks tell you what I typed; they don't tell you what I saw. So I built the smallest skill that closes that gap — naming convention, capture command, embed snippet — and we'll see it in action below.

The pre-flight summary on this install came back clean against the same twelve checks as last time. Node 22 on the system, gh authenticated, Python 3.14, Docker running, `pipx` available — everything the install assumes. The only finding from pre-flight was structural: I'd just reverted last week's install in the same branch, which left some untracked `.ss/reports/` leftover that the new install would need to deal with. Trivial, called out, moved on.

## The Reinstall — Where the Old Tree Gets Cleared

The genuinely new bit. The packaged installer does three things the script-copy one didn't:

1. **Cleans up legacy `.ss/scripts/`** — if it finds the old script-copy layout in the target, it deletes it. The wheel owns those files now; carrying duplicates in the adopter's tree only causes drift.
2. **Scrubs byte-equal templates** — if `.ss/playwright.config.js` or `.ss/server.js` exists and is byte-identical to what's bundled, it removes them. The override path is for genuine customisations, not for accidentally-pinned old copies.
3. **Installs the CLI** — `pipx install slopstopper-cli` (or refresh, if already present).

What I expected was a clean install: 20 workflows refreshed, CLI bumped from nothing to 0.5.0, config files seeded. What I got was the first finding.

```text
✅ Taskfile.ss.yml installed (refreshed)
✅ Taskfile.yml installed
✅ slopstopper-cli installed (slopstopper 0.1.0)
✅ 0 workflow(s) installed, 0 refreshed, 20 previously-deleted skipped
```

Two things wrong in those four lines. First, the CLI version was `0.1.0` — the actual PyPI release is `0.5.0`. `pipx upgrade` had silently failed (errors swallowed by `2>/dev/null` in the installer), and the success message reported whatever was installed as if it had just been installed. Second, *zero* workflows landed. The installer thought I'd "previously deleted" all twenty. A leftover `.ss/.workflows-installed` from an abandoned earlier attempt — committed on that branch, untracked on this one, never cleaned up — listed every workflow as previously-installed, and the deletion-respect logic skipped every one of them.

Workarounds, both one line:

```bash
pipx install --force slopstopper-cli   # picks up PyPI 0.5.0 properly
rm -rf .ss/ && bash install.sh .       # clears the leftover marker
```

Both are now upstream bugs on the slopstopper backlog. The success message lying about the version is the worse of the two — silent install failure with a green tick is exactly the failure mode the suite exists to prevent. **First adopter installs are where you find out which "obviously working" code paths are obviously working only on slopstopper.dev itself.**

## The Local-First Green Loop

Pass A runs in seconds. The skill kicks off `task ss:hygiene:test` and watches every check:

```text
✅ ss:hygiene:lint            (markdownlint, silent pass)
✅ ss:hygiene:structure       (docs/index.md found)
✅ ss:hygiene:size            (no oversized markdown)
✅ ss:hygiene:docs-size       (7 files, 14 KB, within 150 KB cap)
✅ ss:hygiene:docs-structure  (Map Pattern table matches directory tree)
✅ ss:hygiene:docs-accuracy   (no broken links, no stale file refs)
✅ ss:hygiene:entry-files     (README 205w / AGENTS 356w / CLAUDE 1w, all under 1500)
✅ ss:hygiene:complexity      (no CCN > 10)
✅ ss:hygiene:csp-exceptions  (0 exceptions, 0 documented, no drift)
✅ ss:security:secrets        (Gitleaks: no leaks in 125 commits)
✅ ss:security:sast           (Semgrep: 4 warnings, 0 errors)
✅ ss:security:vulnerability:all  (Trivy: 2 HIGH CVEs reported, exit 0)
```

The complexity check was actually finding #4 from this install. `slopstopper doctor` cheerfully reported `lizard found at /opt/homebrew/bin/lizard` — and then `slopstopper run hygiene:complexity` failed with "lizard is not installed". The doctor was finding the brew-installed `lz4` lizard (a completely different tool) on the system PATH; the actual check needs the Python `lizard` package inside the pipx venv. One `pipx inject slopstopper-cli lizard` later, the check went green.

Pass B needs a built site:

```bash
npm run build
slopstopper serve &
SMOKE_TEST_URL=http://localhost:8080         task ss:reliability:smoke
ACCESSIBILITY_TEST_URL=http://localhost:8080 task ss:reliability:accessibility
SEO_TEST_URL=http://localhost:8080           task ss:reliability:seo
BROKEN_LINKS_TEST_URL=http://localhost:8080  task ss:reliability:links
CWV_URL=http://localhost:8080                task ss:reliability:cwv
DAST_TEST_URL=http://localhost:8080          task ss:security:dast
```

This is where the next three findings landed in quick succession.

**Smoke first run** — Playwright errored with `MODULE_NOT_FOUND` trying to load its own config. The packaged install ships `playwright.config.js` inside the wheel; when Playwright tries to resolve `@playwright/test` from there, the lookup starts inside `~/.local/pipx/venvs/slopstopper-cli/lib/python3.14/site-packages/slopstopper/data/` — which has no `node_modules` and never will. Fix: `slopstopper templates eject playwright.config.js`. Then the ejected config can't find the test specs (they're still in the wheel, addressed relative to the original wheel path). Fix: eject the specs too. Three more `eject` commands and smoke went green: 6/6 against `localhost:8080`.

**DAST against headers that don't exist** — local DAST found Medium-risk findings for `Content Security Policy (CSP) Header Not Set` and `Missing Anti-clickjacking Header` on every page. The headers were in `public/_headers` (the Cloudflare text format) but `slopstopper serve` doesn't parse that format — only `worker/headers.json` (JSON array). So locally the server sent no security headers; ZAP correctly flagged it. Fix: a parallel `worker/headers.json` mirroring the same rules. Annoying because now we maintain two files that say the same thing, but the gate works. Upstream finding: `slopstopper serve` should natively parse Cloudflare `_headers` — the format is small, the CSP-exceptions check already does it, and adopters on Cloudflare are the most common case.

**Accessibility flagged Klaro** — three contrast violations, all inside the Klaro cookie consent UI elements (`.klaro`, `#service-item-analytics-description`, `#service-item-marketing-description`). The Klaro library ships its own contrast styling that doesn't quite meet WCAG 2 AA, and overriding it at the page level is a fool's errand because Klaro injects markup into a custom-element shadow. Fix: `.exclude('.klaro').exclude('[id^="service-item-"]')` in the accessibility spec. Audit stays honest about site code (which I control) and quiet about Klaro's modal (which I don't).

After the four fixes, the green loop is fully green:

| Pass | Check | Result |
| ---- | ----- | ------ |
| A | Hygiene (9 sub-checks) | 9/9 ✅ |
| A | Security (3 sub-checks) | 3/3 ✅ |
| B | Smoke | 6/6 ✅ |
| B | Accessibility | 5/5 ✅ |
| B | SEO | 5/5 ✅ |
| B | Broken links | 1/1 ✅ |
| B | Core Web Vitals | 3 Lighthouse runs, all ✅ |
| B | DAST | 0 blocking, 24 documented exceptions ✅ |

**Honest moment.** Three of the seven install findings were things `slopstopper.dev` couldn't have caught on its own infrastructure. The CLI version-lying happens because the dev repo always has a local editable install; the workflow-deletion false positive happens because a fresh slopstopper.dev install never has stale manifests; the bundled-server `_headers` parser is missing because slopstopper.dev manages its own headers via JSON, not the Cloudflare text format. The first adopter walking through the install on a real repo is the only place you find these.

## Pushing — Seventeen Green, One Red

I pushed the branch and watched eighteen GitHub Actions runs spin up. The Cloudflare Workers Builds preview deploy ran alongside.

Seventeen passed first time. One came back red — `Scan Dependencies with Trivy` — and the failure was a sharp little local-versus-CI divergence I hadn't expected. Locally `task ss:security:vulnerability:all` had run Trivy, reported "2 HIGH vulnerabilities found", and exit-0'd. The CI workflow runs the same Trivy scan but adds an explicit *"Fail job if critical/high vulnerabilities"* step that exits 1 on any HIGH or above. Adopters get a green local check and a red CI check for the same scan, which is the worst-of-both: I'd been told everything was fine by my own machine, and the build proved me wrong forty seconds after push.

The CVEs themselves were both in `esbuild@0.27.x` (fix in `0.28.1`), pulled in transitively by Astro 6 + Vite 7 + Wrangler. The fix was a single npm override:

```json
"overrides": {
  "vite": "^7",
  "esbuild": "^0.28.1"
}
```

`npm install` deduped all three dependents to esbuild 0.28.1. Re-running Trivy locally — clean. Pushed again, CI now eighteen of eighteen green. Counting it as the seventh install finding: **the local task and the CI workflow should agree on what counts as a blocking finding.** Either the local task should exit non-zero on HIGH+ by default, or the divergence should be a loud warning in the local output. Silent agreement looks like green-on-green; silent disagreement looks like green-then-red, and adopters lose trust in the local loop fast.

## The Seven Slopstopper Findings This Install Raised

Counted in the order they bit me:

1. **`install.sh` pipx upgrade silently fails + lies about the installed version** — `2>/dev/null` swallows the upgrade error; success message reports whatever's installed.
2. **Workflow deletion-tracking false-positives on leftover marker** — an untracked `.ss/.workflows-installed` from a prior branch makes the installer think the user deleted everything; result is a silent zero-workflows install.
3. **`seed_template` won't overwrite an existing `public/_headers`** — adopters with cache-only headers (like the HTML revalidation policy this site needs) lose the security-headers baseline. The original install had a separate "wire security headers" follow-up commit precisely because of this.
4. **`lizard` must be manually injected into the pipx venv** — `slopstopper doctor` finds the brew `lz4` lizard on PATH and reports green; the actual complexity check fails because the wheel needs Python `lizard` inside its own venv. Workaround: `pipx inject slopstopper-cli lizard`.
5. **Playwright config + test specs need to be ejected** — wheel-bundled copies can't resolve `node_modules` from inside the pipx venv path. Workaround: `slopstopper templates eject` for the config and all three specs.
6. **`slopstopper serve` doesn't read Cloudflare `_headers` text format** — only `worker/headers.json`. Adopters on Cloudflare (the most common case) need a parallel JSON file for local DAST to see security headers.
7. **Vulnerability check local/CI threshold mismatch** — `task ss:security:vulnerability:all` exits 0 with HIGH CVEs as warnings, but the CI workflow's "Fail job if CRITICAL/HIGH" step exits 1. Silent local green, silent CI red, on the same scan.

All seven have one-line workarounds and the install ships green after them. They're issues a real adopter would hit, in the order they'd hit them, on a Sunday morning when they expected a curl-pipe-bash to leave them ready to push. Worth the bug reports they're about to generate.

## How I Actually Use Slopstopper

I'm a few months in and the patterns are starting to settle, so a "would I use it" verdict overstates the experience. What's true now: I install it on every new project of mine, I use the local-first loop more than I expected to (the `task ss:hygiene:test` + `task ss:reliability:smoke` pair runs more often than `git status`), and the per-PR check matrix has become the thing I check first when something feels off on the site.

The packaging revamp didn't change those patterns — same loops, same outputs. It changed two things that matter for the people I'd recommend it to:

- **New checks land in days, not curl-pipe-bashes.** Last week's seven follow-ups are in the wheel now. Adopters who already installed get them on the next `pipx upgrade slopstopper-cli` or `install.sh` re-run. No workflow refresh, no script-copy churn.
- **The `.ss/` directory is no longer something you have to understand.** Adopters who never touch slopstopper internals never see them; adopters who customise eject the one file they care about. The cliff between "I installed it" and "I'm reading bash scripts in `.ss/scripts/` to figure out why a check is failing" is gone — `slopstopper-triage` reads the wheel's source the same way the user would.

**Would I recommend the packaged version to a fellow hungovercoder?** Yes, with one caveat I'd not have given a week ago: do the install with the skill driving and pipx version-pinned. The seven findings above mean that the first ten minutes of an adopter install on a non-trivial real repo are still spent triaging the suite's own gaps, not validating your code. By a week from now those gaps should be closed; until then, the skill catches them and the recovery is one workaround each.

**What I'd do differently.** Move the docs Map Pattern setup into the CLI itself. The skill walks me through writing `docs/index.md` + five category READMEs on every install — and they're the same five categories every time, for every adopter who isn't slopstopper.dev. A `slopstopper scaffold map` command that drops a skeleton I can edit would save the skill's longest step and make the install's structural check pass by default. Probably the next batch.

Well done fellow hungovercoder — go pour yourself a sweet sweet [tiny-ipa](https://tinyrebel.co.uk/) and try the new shape on something of yours. The skills will walk you through it, and the seven findings above are now your seven warnings — the curl-pipe-bash will still leave you with a working install, just don't be surprised when the first ten minutes are spent finding what I found.

Cheers.
