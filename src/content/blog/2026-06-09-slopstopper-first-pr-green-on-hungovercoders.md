---
title: "Slopstopper — First PR Green on hungovercoders"
date: 2026-06-09
author: dataGriff
description: "I built slopstopper. I built a Claude Code skill to install it. Then I dropped both on hungovercoders from a fresh main branch and watched eighteen CI checks go green — sixteen on the first push, all eighteen on the second. Here's what landed, what bit me, and what I'm shipping next"
tags:
- slopstopper
- ai
- devops
- claude-code
- cloudflare
- hungovercoders
image:
  path: /assets/2026-06-09-slopstopper-first-pr-green-on-hungovercoders/link.png
---

I've been vibe-coding more than I'd like to admit lately — Claude Code shipping features faster than I can think about whether they're actually safe. It's a brilliant way to get something working on a Tuesday night, but the honest version is this: I'm not great at security, I'm not great at testing, and the faster I move the more there is for a future me to regret. So I built [slopstopper](https://slopstopper.dev/) — partly to learn the gates I should have been running all along, partly so I'd never have to remember to run them again. One curl into any repo and the suite shows up: SAST, DAST, secrets, CVEs, accessibility, performance, doc hygiene, the lot. If I can't remember which scanner to install, I shouldn't have to — the install should remember for me.

## What it actually does

Five feedback loops, all firing on every PR and every push to `main`. The same `task ss:*` command runs them locally and in CI — same source, same output, no drift between dev and pipeline.

| Loop | What it does | Tools under the hood |
| --- | --- | --- |
| 🔒 **Security** | SAST, DAST, secrets, dependency CVEs, dependency review | Semgrep, OWASP ZAP, Gitleaks, Trivy |
| 🧹 **Hygiene** | Complexity caps, doc structure / accuracy / size, entry-file budget, CSP drift, auto-label PRs | Lizard, custom Python, actions/labeler |
| ✅ **Reliability** | Smoke, accessibility (WCAG 2.1 AA), Core Web Vitals, SEO + OpenGraph, broken links | Playwright, axe-core, Lighthouse CI |
| 🤖 **Operations** | Failed workflows auto-raise issues; an agentic doc updater opens weekly sync PRs | GitHub Actions, gh-aw |
| 🚀 **Deployment** | Preview deploys per PR, prod releases, preview cleanup | Cloudflare Workers Builds |

Deployment is the only loop that lives outside slopstopper — Cloudflare Workers Builds handles it via Git integration, no GitHub Actions involvement, no secrets dance. The other four are the suite proper. The bit that mattered most to me when I designed it was the *bundling*: I never have to remember which tool catches what. I just install slopstopper, and whatever's broken comes back to me as a red check with a `task ss:*` command to reproduce it on my laptop. That's the learning loop. The first time `ss-security-dast-check.yml` flagged a CSP I didn't understand, I went and read about CSP. The first time Trivy yelled at me about a transitive CVE, I went and read about Trivy. The suite is a reading list I can't avoid.

The rest of this post is the honest tour of bringing it home — installing slopstopper on this very site from a fresh `main` branch and watching what broke. Sixteen of eighteen checks went green on the first push. The other two taught me something. Here's how.

## Pre-Requisites

- A repo you'd like to add quality gates to
- A terminal and `curl`
- Optional: [Task runner](https://taskfile.dev) (`brew install go-task/tap/go-task` on macOS) if you want to run the same checks locally
- Optional: [Claude Code](https://claude.com/claude-code) — the `slopstopper-install` skill drives the whole install end-to-end and catches the gotchas before they bite

## Cracking Open the Install — the Skill Driving

The Claude Code skill is the thing I'm most pleased with from this batch. The install is one curl on its own, but a skill turns it into a guided conversation: it reads your repo first, predicts where the install will bite, runs the installer, configures `.slopstopper.yml`, sets up the Map Pattern for docs, drops in a `server.js` shim, augments your security headers, generates README badges, and only then drives a **local-first green loop** before letting you push. The whole point being: by the time CI runs on the PR, it's a confirmation pass, not a discovery pass.

You install the skill trio the same way as slopstopper itself:

```bash
curl -fsSL https://raw.githubusercontent.com/hungovercoders/slopstopper/main/install-skill.sh | bash
```

That lands three skills in `~/.claude/skills/`: `slopstopper-install` (this one), `slopstopper-update` (refreshing an existing install), and `slopstopper-triage` (diagnosing a failed check end-to-end). I used the first one for the hungovercoders install I'm about to walk through. It read [AGENTS.md](https://github.com/hungovercoders/site/blob/main/AGENTS.md) for the deploy model and per-post share-image convention, predicted three Phase 1 gaps based on those facts, then drove the install accordingly. Pre-flight is the half of the install that matters — by the time the curl ran, the skill already knew what was going to be awkward.

## The Local-First Green Loop

The skill's Step 7 is the spine of a good install. Every slopstopper check has a local `task ss:*` equivalent. Run them locally in a tight loop — fix, re-run, fix, re-run — and you go an order of magnitude faster than pushing-and-waiting-on-CI for each iteration.

Two passes:

**Pass A — static checks**, no URL needed, runs in seconds:

```bash
task ss:hygiene:docs-accuracy   # check
task ss:hygiene:docs-structure  # check
task ss:hygiene:docs-size       # check
task ss:hygiene:entry-files     # check (README/AGENTS/CLAUDE word budget)
task ss:hygiene:csp-exceptions  # check (your per-path CSP relaxations are documented)
task ss:security:secrets        # Gitleaks
task ss:security:sast           # Semgrep
task ss:security:vulnerability:all  # Trivy
```

**Pass B — dynamic checks**, need a built site on `:8080`:

```bash
npm run build
node server.js &
SMOKE_TEST_URL=http://localhost:8080         task ss:reliability:smoke
ACCESSIBILITY_TEST_URL=http://localhost:8080 task ss:reliability:accessibility
SEO_TEST_URL=http://localhost:8080           task ss:reliability:seo
BROKEN_LINKS_TEST_URL=http://localhost:8080  task ss:reliability:links
CWV_URL=http://localhost:8080                task ss:reliability:cwv
DAST_TEST_URL=http://localhost:8080          task ss:security:dast  # needs Docker
```

I want to be honest about one Pass A failure that doesn't matter for CI: `ss:hygiene:lint` on my laptop ran markdownlint's default config and instantly flagged every realistic markdown file in `docs/` for the 80-character line-length rule. That isn't wired to any CI workflow yet — there's no `ss-hygiene-lint-check.yml` — so the first-PR-green wasn't blocked, but it's a real local-loop pain point. Already on the list to fix in slopstopper.

The DAST local loop also failed on macOS, but for a different reason: the ZAP container tries to reach `localhost` as `172.17.0.1` (the Linux Docker bridge gateway), which isn't routable from Docker Desktop on macOS. CI on Linux runners is fine. Adding a `host.docker.internal` fallback to the DAST task is on the list too. The triage skill caught both as known-non-blockers.

## Pushing — Sixteen Green, Two Red

I pushed the branch. The first CI run came back with sixteen passes and two fails. The honest version of each fail:

### Dependency Review needed Dependency Graph enabled

Five-second fail:

```text
##[error]Dependency review is not supported on this repository.
Please ensure that Dependency graph is enabled.
```

The skill's pre-flight Step 10 had already predicted this — the `actions/dependency-review-action` needs Dependency Graph enabled on the repo, which for public repos is usually default-on but can be off if the org has a policy. hungovercoders/site did. One toggle in GitHub's security settings and the rerun went green. Not a slopstopper bug, but the skill's pre-flight calling it out before the install was the difference between "oh, that's why" and "what the hell is this."

### DAST flagged the GTM bootstrap

This was the genuinely interesting one. Two-minute fail:

```text
WARN-NEW: Storable but Non-Cacheable Content [10049] x 5
WARN-NEW: CSP: script-src unsafe-inline [10055] x 10
⚠️  Found 4 medium/high alert(s)
```

The site's `public/_headers` sets `Cache-Control: public, max-age=0, must-revalidate` on every HTML response — that's deliberate, it's what stops the Cloudflare edge serving stale pages after a deploy. ZAP flagged the deliberate revalidation as "storable but non-cacheable." The unsafe-inline CSP rule fires because Google Tag Manager bootstraps via an inline `<script>` from `BaseHead.astro`, and I'd rather keep GTM than fight Astro's static-site adapter into a runtime nonce dance for a personal blog.

Both are explicit policy choices, both got added to `.zap/rules.tsv` as `IGNORE` rules with the justification right there at the point of suppression. Second push: eighteen of eighteen green.

**Honest moment.** I'd worked around a separate slopstopper bug in `check-csp-exceptions.py` by restructuring `docs/security/CSP_EXCEPTIONS.md` — moving the site-wide `### /*` heading out of the `## Exceptions` table. That workaround silently broke the DAST gate's "swallow documented findings" mechanism, because both checks read the same file with different assumptions. I'd built two checks that read the same source-of-truth and didn't notice they parsed it asymmetrically until DAST went red on a repo that wasn't slopstopper.dev. **First adopter installs are where you find out which of your "obvious" assumptions are actually slopstopper-shaped.**

## Phase 1.1 — What This Install Pushed Upstream

Counting the lint default, the asymmetric CSP parser, the DAST macOS gap, the gitignore missing `__pycache__`, the install.sh's stale Playwright stdout, the docs-structure report hardcoded to slopstopper's own categories, and the install.sh source-detection bug — seven follow-ups on slopstopper. None are CI-blocking, all surfaced by walking through the install on a non-trivial existing repo with the skill watching for drift. Worth saying again because it's the only metric that matters: the first PR was green out of the box on Phase 1.1.

## Verdict

**Would I recommend this to a fellow hungovercoder running a small site or a tutorial repo?** Yes. The install is genuinely one curl, the first PR is green, the local-first loop means you fix things at your terminal in twenty seconds instead of in a CI-push-wait-fix-push loop. The Map Pattern docs scaffold is the bit I'm most pleased with — three thin entry files, one canonical map, and a build that fails when those drift. Means an agent walking into the repo cold lands on a sensible front door instead of a wall of detail, and means humans don't have to keep three READMEs in sync by hand.

**Would I drop it on a monorepo with twenty packages and a custom CI rig?** Not yet. The skill's pre-flight surfaces collisions, but the install is currently shaped for a single Astro / Next / SvelteKit site with one `package.json` at the root. A monorepo flavour would need workflows that scope to changed packages and a Taskfile-include strategy I haven't built yet. On the list.

**What I'd do differently.** Ship `task ss:doctor` in the first installable cut. The local-first loop is the most valuable thing about slopstopper and it should be one command, not a sequence of eight `task ss:*` invocations I had to remember. Adopters shouldn't have to read the skill to know how to run their own pipeline locally. That's the next batch.

Well done fellow hungovercoder — go pour yourself a sweet sweet [tiny-ipa](https://tinyrebel.co.uk/) and try it on something of yours. The skill will walk you through it, and if anything goes red the triage skill will explain why before you've had to chase it yourself.

Cheers.
