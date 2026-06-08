---
title: "Stopping the Slop on hungovercoders"
date: 2026-06-08
author: dataGriff
description: "What slopstopper is, how I built it, and the honest story of installing it on hungovercoders.com — five loops of CI feedback, one curl one-liner, nineteen workflows, and nine red checks that taught me exactly what assumptions the install ships with"
tags: [slopstopper, ai, devops, cloudflare, github-actions, hungovercoders]
image:
  path: /assets/2026-06-08-slopstopper-stopping-the-slop-on-hungovercoders/link.png
---

I wanted to stop AI-generated slop landing in my repo without me noticing — and I wanted to do it with one curl command, on every PR, on every push, forever. So I built [slopstopper](https://slopstopper.dev). It's a portable suite of GitHub Actions, Task targets, and analysis scripts that you drop into any repo to get a consistent quality pipeline: security, hygiene, reliability, runbooks, and deployment, all firing on every change. The duality of it is that it's two things at once — a portable installer you run into your own repo, *and* a live reference site (slopstopper.dev) that runs the same suite on itself so every badge in the README is real. This post is the appetiser: what slopstopper is, the decisions that went into it, and the actual story of installing it on this site, gotchas and all. The hungovercoders install is the first real-world install into a non-trivial existing repo, and three things broke on the first run that I didn't expect. They're in here.

## Pre-Requisites

- A repo you'd like to add quality gates to
- A terminal and `curl`
- About fifteen minutes
- Optional: a [Task runner](https://taskfile.dev) install if you want to run checks locally as well as in CI (`brew install go-task/tap/go-task` on macOS)

## What's On the Programme — The Five Loops

The shape of slopstopper is five feedback loops. Each one fires on every PR and every push to `main`, and you can also run any of them locally because the same `task ss:*` command runs in both places — same source, same output, no drift between dev and pipeline.

| Loop | What it does | Tools under the hood |
| --- | --- | --- |
| 🔒 **Security** | SAST, DAST, secrets detection, dependency CVE scanning | Semgrep, OWASP ZAP, Gitleaks, Trivy |
| 🧹 **Hygiene** | Cyclomatic complexity caps, doc structure / accuracy / size checks, auto-labelled PRs | Lizard, markdownlint, custom Python checks |
| ✅ **Reliability** | Smoke tests, accessibility audits (WCAG 2.1 AA), Core Web Vitals, SEO + OpenGraph metatag checks, broken-link audits | Playwright, axe-core, Lighthouse CI |
| 🤖 **Runbooks** | Failed workflows auto-raise GitHub issues; an agentic doc updater opens weekly sync PRs | GitHub Actions, gh-aw |
| 🚀 **Deployment** | Preview deploys per PR, automated production releases, automatic preview cleanup | Cloudflare Workers Builds (Git integration) |

The deployment loop is the only one that lives outside slopstopper itself — Cloudflare Workers Builds handles it via Git integration, no GitHub Actions involvement, no secrets dance, no preview-environment plumbing. The other four loops are the suite proper.

## Cracking Open the First Pipeline

The install is one curl. You run it in the root of whatever repo you want slopstopper to look after:

```bash
curl -fsSL https://raw.githubusercontent.com/hungovercoders/slopstopper/main/install.sh | bash
```

It clones the slopstopper template into a temp directory, then copies the relevant bits into your repo under an `ss` namespace so it never clobbers your existing files. On hungovercoders the output was:

```text
🛠  SlopStopper — installing tooling
  Source : /var/folders/.../template
  Target : /Users/richardgriffiths/dev/hungovercoders/site
────────────────────────────────────────────────────────────
  ✅ Taskfile.ss.yml installed (refreshed)
  ✅ Taskfile.yml installed
  ✅ .ss/scripts/ installed (refreshed)
  ✅ .ss/tests/ installed (refreshed)
  ✅ .ss/ Playwright + Lighthouse configs installed (refreshed)
  ✅ 19 workflow(s) installed, 0 refreshed, 0 previously-deleted skipped
  ✅ Added devDependencies: @axe-core/playwright, @lhci/cli, @playwright/test, markdownlint-cli, typescript
```

Nineteen workflows in one shot. The site repo had zero GitHub Actions before this — it deploys via Cloudflare Workers Builds, which doesn't need any. So the install was the entire CI story for hungovercoders, landed in about eight seconds.

The installer is idempotent. Re-running it pulls newer checks but respects deletions via a tracker at `.ss/.workflows-installed` — workflows you deliberately remove don't sneak back in on the next install. That's the bit I'm most pleased with: it means slopstopper can grow without yanking the rug out from under repos that have already adopted it.

## How I Built It — A Few Decisions Worth Talking About

I'm not going to walk the whole codebase — the README has the tour and the site has the marketing pitch. But the design decisions that turned out to matter most are these.

### Task as the one interface

Every check is defined as a `task ss:*` target in `Taskfile.ss.yml`. The GitHub Actions workflows are thin — they install the prerequisites and then run the same `task ss:security:sast` or `task ss:hygiene:complexity` command you'd run on your laptop. No drift between local and pipeline. No "passes on my machine, fails in CI." If a check is broken, you can reproduce it in twenty seconds at your terminal, fix it, and know the CI run will match. This is the bit my CLAUDE.md global instructions push for in every project ("reduce duplication between what AI agents, developers, and CI run") and slopstopper is what it looks like when you take that seriously.

### `worker/headers.json` as a single source of truth

The slopstopper.dev site itself runs on Cloudflare Workers, and every security header it serves lives in one file: `worker/headers.json`. The Worker reads it. The local dev server reads it. The CSP drift-check (`ss:hygiene:csp-exceptions`) reads it. If you relax a CSP rule, you must document the why in `docs/security/CSP_EXCEPTIONS.md` or the check fails the build. One file, three readers, no way for prod and dev to disagree about what a Content-Security-Policy header should say.

### The `ss` namespace and the Map Pattern for docs

Two related decisions. Every slopstopper-owned file is under the `ss` namespace — `Taskfile.ss.yml`, `.ss/scripts/`, `ss-*.yml` workflows. Your repo's own files are not touched, ever. And the docs follow the Map Pattern: thin entry files (README.md, AGENTS.md, CLAUDE.md, all kept under a token budget that's enforced by `ss:hygiene:entry-files`) point at `docs/index.md`, which is the governance spec. CI fails the build if the `docs/` tree drifts from the map. The entry files don't bloat, the map doesn't lie, and an agent reading the repo cold lands on a sensible front door instead of a wall of detail. The film picker post talks about `CLAUDE.md` as a recipe card — the Map Pattern is the same idea applied to a whole repo's documentation.

### Dogfooding

slopstopper.dev is built and deployed with the same suite it advertises. Every badge in the README is real — green means the latest run of *that exact check* on *this exact repo* passed. If I add a new check to slopstopper, the first thing it does is run on slopstopper itself. That's how I know the suite holds together. If I can't make it pass on its own codebase, it's not ready to ship to anyone else's.

## Cracking It Open on hungovercoders

Now the actual story. I ran the one-liner in `~/dev/hungovercoders/site`. The install completed cleanly. I ran `npm install` to pick up the merged devDeps, then the critical regression test: `npm run build`. The site builds via Astro into `dist/client` and then pagefind indexes 130 pages — both still worked. Cloudflare deploy unchanged, no surprises there.

Then I configured URL defaults. The reliability workflows (smoke, a11y, Core Web Vitals, SEO) all default to scanning `slopstopper.dev` because that's the reference repo they ship from. For hungovercoders I wanted them pointing at `https://www.hungovercoders.com`, so I swapped three things in each affected workflow: the `workflow_dispatch.inputs.url.default`, the scheduled-run fallback `echo "url=…"`, and the page lists (from `'/,/features.html,/tools.html,/feedback.html'` over to `'/,/about,/blog'`). Took five minutes.

This is where I'd flag a tradeoff honestly: hardcoded edits inside `ss-*.yml` workflows get **wiped on the next `install.sh` re-run**, because the installer refreshes those files. The cleaner long-term answer is GitHub repo variables (which persist across reinstalls) or a config-file mechanism in slopstopper itself. The hardcode-in-workflows path is fine for now — it works immediately and lives in source control — but it's on the list to upstream.

## Where I Cocked It Up

Three things broke at my keyboard before I'd even opened the PR. Then the PR itself opened and another six checks went red. None of them were slopstopper bugs — all of them were the slopstopper suite telling me, loudly, exactly what assumptions it ships with that don't fit a non-trivial existing repo. The honest version, in the order I hit them:

### Gitleaks flagged a "secret" I'd forgotten about

```
generic-api-key | src/content/blog/2024-06-29-cosmos-emulator-docker-local.md:642
```

A blog post from 2024 about running Cosmos DB locally has an example connection string in it. Gitleaks correctly matched it as a Generic API Key. It's a tutorial example — the credential is the documented Cosmos emulator default that Microsoft ship in their docs, no real exposure — but the scanner doesn't know that and shouldn't be expected to. The right fix is a `.gitleaks.toml` with a path-specific allowlist that says *yes, this file is allowed to contain this pattern, here's why.* That makes the exception loud and source-controlled instead of quietly disabling the whole check. Real finding, fair flag, easy fix.

### The complexity check exploded because I have two binaries called `lizard`

```
Incorrect parameters
Usage : lizard [arg] [input] [output]
Arguments : -10...-19 : compression method fastLZ4...
```

The Python cyclomatic-complexity tool is called `lizard` (`pip install lizard`). The lz4 compression utility is also called `lizard` and ships via Homebrew. My PATH was resolving to the compression one. Slopstopper called what it thought was the complexity tool, got compression-utility help text, and bailed. This is a host environment collision, not a slopstopper bug — but it's exactly the kind of thing that bites on macOS dev machines and would also bite a CI image with the wrong setup. Worth a sentence in the install guide and probably worth invoking via `python3 -m lizard` in the slopstopper task to dodge the PATH lottery entirely.

### The dynamic reliability workflows want a `server.js` and I haven't got one

The smoke, accessibility, Core Web Vitals, SEO and DAST workflows all have a PR/push code path that says: build the site, run `node server.js` on port 8080, then test against `http://localhost:8080`. That works on the slopstopper.dev repo because it's a static site with a bundled `server.js` — it does not work on an Astro site that builds to `dist/client` and expects a Worker or a dev server to serve it. So on PR/push those workflows fail at "Start local server" with a polite `No server.js — customise this step or set X_TEST_URL.` exit. The scheduled runs against the live hungovercoders.com URL still work fine; it's only the local-build path that breaks.

I fixed this with a twenty-line ESM `server.js` shim that serves `dist/client/` on port 8080. Static MIME-typed file server, no dependencies, ignores the Worker bundle in `dist/server/`. Now the local-build paths for accessibility, SEO, Core Web Vitals and Playwright all start a real local server against the real built output. Honest dev/CI parity, twenty lines of code.

### Node 20 in the workflows, Node 22+ required by Astro

The slopstopper workflows that run `npm` (`ss-reliability-*`, `ss-playwright-tests`, `ss-security-dast-check`) all pin `node-version: '20'` in their `actions/setup-node` step. Astro 6 requires Node 22.12+. So `npm run build` failed everywhere with:

```
Node.js v20.20.2 is not supported by Astro!
Please upgrade Node.js to a supported version: ">=22.12.0"
```

This was the single biggest source of red checks — one root cause behind four failures. Fix was a global swap of `node-version: '20'` to `'22'` across the affected workflows. The cleaner upstream answer is for slopstopper to either bump its default to the latest LTS or, better, read `engines.node` from the target's `package.json` so the workflow's Node version matches the project's own requirement. On the to-upstream list.

### Three workflows that didn't fit and got deleted

Some checks just don't apply to this site:

- **CSP exceptions drift check** assumes a `worker/headers.json` file as the single source of truth for security headers. That's slopstopper.dev's pattern — its Worker reads that file and the drift-check guards it. The hungovercoders site uses Astro's `@astrojs/cloudflare` adapter, which serves headers via the adapter's own config, not via an edge-headers JSON. The check has nothing to guard. Deleted.
- **DAST (OWASP ZAP)** needs a meaningful runtime surface to scan, and on a static-rendered blog the value-to-overhead ratio isn't there yet. Could revisit if we add anything dynamic. Deleted for now.
- **Dependency Review** (the new-vulnerability gate on PRs) needs GitHub Advanced Security or a public-repo Dependency Graph to be enabled in repo settings. It returned a `Dependency review is not supported on this repository` error. Toggling the setting is a repo-admin action, not a code change — deleted for now and we'll re-enable when the Dependency Graph setting is turned on.

The deletions are remembered by slopstopper's `.ss/.workflows-installed` tracker, so a future `install.sh` re-run won't quietly bring them back. That's the bit of the installer I'm most pleased with, in hindsight — it respects what you've removed.

### The auto-label workflow has no labeler config

Slopstopper ships `ss-hygiene-auto-label-pr.yml` (an `actions/labeler@v5` runner) without a `.github/labeler.yml` config file. The action fails with `The config file was not found at .github/labeler.yml`. Fair — the labels are by definition repo-specific. Fix was a one-off `.github/labeler.yml` mapping site-relevant globs (`src/content/blog/**` → `blog`, `src/content/projects/**` → `projects`, `.github/**` → `ci`, etc.) to labels. A starter `labeler.yml` template alongside the install would be a kind addition to slopstopper.

## Watching the Lights Go Green

Pushing the second commit and watching the Actions tab refresh — nine red ❌s slowly turning green one by one, in the order the workers finished — was honestly the most satisfying part of this whole exercise. Not "haha, finally CI behaves" satisfying. Properly satisfying. Every green tick was a gate I'd never had on this site before, now alive and watching forever.

Here's the inventory of what I got out of the install, in concrete terms.

**Now running on every PR and push to `main`, without me lifting another finger:**

- **Semgrep** running SAST across the codebase. Zero findings on the first run, but the *gate exists* — the day I (or Claude Code) writes something Semgrep doesn't like, the PR can't merge until I look at it.
- **Trivy** scanning every dependency for CVEs. Same — clean today, watching forever.
- **Gitleaks** checking every commit for credential patterns. It found the Cosmos emulator example, which is exactly the kind of thing I'd never have noticed if I weren't looking, and now I've got a documented `.gitleaks.toml` allowlist saying *yes this file is allowed to contain this, and here's the Microsoft link explaining why.* Loud-and-source-controlled beats quietly-disabled every day of the week.
- **Lizard** capping cyclomatic complexity. If a function gets gnarly, the build fails before it lands.
- **Lighthouse CI** enforcing a Core Web Vitals budget. Performance regressions can't sneak in.
- **`actions/labeler`** auto-labelling every PR by what it touched (blog, training, ci, deps, deploy…). Trivial individually, magic when you stop having to do it.
- **Doc structure / accuracy / size** checks keeping the entry files (`README`, `AGENTS`, `CLAUDE`) under a token budget and the cross-references honest. The Map Pattern from slopstopper, applied here.
- **Smoke / accessibility / SEO** audits running hourly against the live site *and* on every PR against the local build via the `server.js` shim. So between Cloudflare's preview deploy and slopstopper's audits, every PR gets a real environment that gets really tested.
- **Workflow failure tracker** that auto-opens a GitHub issue if any of the above starts failing on `main`, so I can't ignore a regression because I happened to be looking the other way.

**And the thing I didn't expect — the audit actually found something I'd missed.**

The SEO metatag check went red on the first run flagging *every page* as missing all four `twitter:*` tags. My first reaction was "rubbish, I definitely have twitter cards." I opened the rendered HTML and there they were. Then I read the check's source: it looks for `name="twitter:card"` (the recommendation per Twitter's own validator) and the site's `BaseHead.astro` was emitting `property="twitter:card"`. Which is *technically valid HTML*, but isn't what the validators read. Which means the twitter cards I'd been confidently shipping for years almost certainly weren't being picked up by Twitter's card preview at all. Two-character fix in one file, every page now passes. I'd never have caught that without a tool that knew to look for the right attribute. **That single finding paid for the install on its own.**

The accessibility audit also surfaced one serious WCAG 2.1 AA violation on `/about` and three on `/blog` — real ones, not workflow misconfig. Those are follow-up work, not for this PR, but slopstopper has now created the visibility that ensures they'll get fixed instead of forgotten.

**What someone else would get by adopting it:** all of the above, for the price of a curl one-liner, twenty minutes of customisation for your repo's specific stack, and a willingness to look at what the first PR turns red. You don't have to choose between security scanning, performance budgets, accessibility eyes, SEO audit, doc hygiene, and dependency CVE alerts — they all come in the same bundle, source-controlled, runnable locally with the same `task ss:*` syntax you'd run in CI. No SaaS subscription, no vendor lock-in, no platform you don't own. Small, cheap, yours. If one slightly hungover person can install it on a Tuesday, that's the bar.

## Verdict

Would I use slopstopper in production? Yes — it's how I want every site I run to look. Five loops of feedback, one curl install, one Task command per check, every gate visible in source control, the whole thing source-controllable and forkable. It's not for every repo — a one-file script doesn't need nineteen workflows, and a repo with a competing quality suite doesn't need to double up. But for a real codebase that wants honest CI without a SaaS bill, this is the shape.

What I'd do differently — the upstream wishlist after this install: a config-file mechanism for per-repo URLs (so the hardcode-in-workflows tradeoff goes away), default `node-version` read from the target's `package.json` `engines` field instead of a hardcoded `'20'` (so Astro/Next sites don't fail on day one), starter `.gitleaks.toml` and `.github/labeler.yml` templates shipped alongside the install (so first-PR false positives and missing-config errors don't ambush new adopters), and a way to mark stack-specific workflows like the CSP-exceptions drift check as opt-in rather than always-on.

One more thing came out of this install. The first-run gotchas you've just read are now bottled into a Claude Code skill that lives inside the slopstopper repo at **[`.claude/skills/install-slopstopper/SKILL.md`](https://github.com/hungovercoders/slopstopper/blob/main/.claude/skills/install-slopstopper/SKILL.md)**. Next time someone (or some agent) installs slopstopper into an existing repo, the skill walks them through the pre-flight checks, the install command, the URL config tradeoffs, the verification steps, and exactly the three gotchas above so they don't have to discover them the hard way. That's the loop I want for any tool I build: install it somewhere real, capture what bit you, hand the next person the lantern.

The slopstopper site is at **[slopstopper.dev](https://slopstopper.dev)**. The repo is **[github.com/hungovercoders/slopstopper](https://github.com/hungovercoders/slopstopper)** if you want to fork it, send a PR, or just read the code. Watch this space for more experimentation between meals — or in case I renamed it drunkenly, [check the GitHub org](https://github.com/hungovercoders). Cheers, fellow hungovercoder.
