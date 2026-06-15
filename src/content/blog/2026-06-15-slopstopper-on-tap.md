---
title: Slopstopper on Tap
date: 2026-06-15
author: dataGriff
description: Installing slopstopper on hungovercoders.com — one task surface, twenty checks, and the honest truth about what bit on a real Astro site
tags:
- Slopstopper
- Astro
- Cloudflare
- Quality Gates
- Taskfile
image:
  path: /assets/2026-06-15-slopstopper-on-tap/link.png
---

I built [slopstopper](https://slopstopper.dev) because I was sick of bolting half-remembered quality gates onto every new repo and watching them drift — the linter you turned off three months ago, the workflow nobody ever pinned to the right Node version, the SEO check copied from somewhere and never tuned. One portable suite of checks I can drop into any repo, that runs the same `task ss:<check>` in CI as I run locally, and stops the slop at source before it ever ends up in a PR.

The only place I'd notice a regression first is this site. Astro 6 on Cloudflare Workers, a blog stuffed with code samples, an Open Graph image per post, the usual GTM container in the head. If slopstopper's going to bite anywhere, it's going to bite here — so this is where I install it first.

This post is the walk through that install. The canonical docs live at [slopstopper.dev](https://slopstopper.dev); this is the path through them on a real site, with the bits that bit me on the way.

## Five Loops, One Bar

Slopstopper is a Python CLI — [`slopstopper-cli`](https://pypi.org/project/slopstopper-cli/) on PyPI — backed by a check suite and twenty GitHub Actions workflows that all defer to `task ss:<check>`. It's dogfooded at [slopstopper.dev](https://slopstopper.dev), where every check in the suite runs against the slopstopper site itself; if a gate doesn't hold up on the tool's own marketing site, it doesn't ship to adopters. Same wheel, same workflows, same Task interface.

I built it because I kept forgetting things on new projects. The accessibility check I meant to add. The SEO meta-tags I'd promised myself I'd audit. The OWASP ZAP scan I kept rationalising as a phase-two job. The Lighthouse CI run that never made it past Slack. The Map Pattern for `docs/` that worked beautifully on one repo and never made it to the next. Five loops, one set of gates, one task surface — codify them once and stop having to remember.

| Loop | What it does | Tools under the hood |
| --- | --- | --- |
| 🔒 **Security** | SAST, DAST, secrets, dependency CVEs, dependency review | Semgrep, OWASP ZAP, Gitleaks, Trivy |
| 🧹 **Hygiene** | Complexity caps, doc structure / accuracy / size, entry-file budget, CSP drift, auto-label PRs | Lizard, custom Python, actions/labeler |
| ✅ **Reliability** | Smoke, accessibility (WCAG 2.1 AA), Core Web Vitals, SEO + OpenGraph, broken links | Playwright, axe-core, Lighthouse CI |
| 🤖 **Operations** | Failed workflows auto-raise issues; an agentic doc updater opens weekly sync PRs | GitHub Actions, gh-aw |
| 🚀 **Deployment** | Preview per PR, prod on merge, preview cleanup on close | Cloudflare Workers Builds |

Deployment sits outside slopstopper — Cloudflare's Git integration handles it, no GitHub Actions involvement, no secrets dance. The other four loops are the suite proper.

## Calling Time on Two Syntaxes

The thing worth leading on is the invocation surface: **`task ss:<check>` is the only one there is**. Local dev, GitHub Actions, you running it on your laptop at half eleven on a Tuesday — same command, same output shape, one mental model. There's no separate CLI to learn for CI because the workflows themselves call `task` exactly the way you do.

It sounds small. It isn't. Most quality-suites I've ever bolted onto a repo have had two flavours of invocation — the one CI uses, and the one humans use — and the two slowly diverge until something fails on CI that's green locally and you spend a wet Wednesday afternoon working out why. Slopstopper closes time on that whole class of problem on the way in, which is by itself worth the install.

## Pouring the First Pint

The install is one curl:

```bash
curl -fsSL https://raw.githubusercontent.com/hungovercoders/slopstopper/main/install.sh | bash
```

That seeds `Taskfile.ss.yml` (the canonical adopter interface — every check is a task here), drops twenty `ss-*.yml` workflows under `.github/workflows/`, merges devDeps for Playwright + Lighthouse CI + axe-core + markdownlint into `package.json`, and writes a `.slopstopper.yml` for you to fill in with your URLs, your pages, and where your security headers live.

![The install.sh banner at the start of the run, cloning the template repository and printing the source + target paths](/assets/2026-06-15-slopstopper-on-tap/step-01-preflight.png)

By the time it finishes, you've got a status block that names every file it touched and tells you which checks are active out of the box, which ones need config, and which ones are inert until you wire secrets in. No guessing what landed.

![The install.sh status block at the end of the run, listing every file it seeded and the canonical task ss:&lt;check&gt; invocation](/assets/2026-06-15-slopstopper-on-tap/step-02-install-output.png)

There's a fair amount of *config* that landed — Taskfile, twenty workflows, `.slopstopper.yml`, the security headers block, the ZAP allowlist, the devDeps in `package.json`. That's all visible, owned, easy to read; you can see exactly what gates your PR. What's striking is what's missing: the directory you'd expect to hold the actual check scripts — `.ss/` — is empty. Just `.workflows-installed` (a manifest so re-runs respect anything you've deleted) and a gitignored `reports/` folder for output. All the check logic, the Playwright specs, the bundled local server lives inside the `slopstopper-cli` Python wheel, not your repo. When a new slopstopper version ships, you `pipx upgrade` and every adopter gets the new behaviour without a single line moving in their repos — no copy-paste, no per-repo drift, no merge conflicts on tool internals when you pull from upstream.

After the install, configure `.slopstopper.yml` (URLs, page lists, headers source path) and push the Node version pin into a GitHub repo variable:

```bash
gh variable set SLOPSTOPPER_NODE_VERSION --body 22
```

A quick `slopstopper doctor` confirms every external tool the suite needs is on PATH — Node, Task, Docker for OWASP ZAP, Python for the Trivy + Lizard backbone. Anything missing is named, with the command to fix it. Run it once after install; you shouldn't need to run it again unless you change your dev box.

![slopstopper doctor showing every required tool found and reachable](/assets/2026-06-15-slopstopper-on-tap/step-04-doctor.png)

Then you're done seeding. From here on it's the local loop.

## Driving It With a Skill

The install is one curl. The hard bit is having the right answers ready: where your build writes to, what Node version you need, whether your headers live in `public/_headers` or `worker/headers.json`, whether you ship a site-wide `/og-image.png` or per-post share images. I also built a [Claude Code](https://claude.com/claude-code) skill — `slopstopper-install` — that asks those twelve questions for you, reads the answers straight out of your repo where it can, then drives the installer, configures `.slopstopper.yml`, sets up the `docs/` Map Pattern, and runs the local Pass A and Pass B until they're both green. By the time CI runs on the PR, it's a confirmation pass, not a discovery pass.

I drove that skill for this install. It read [`AGENTS.md`](https://github.com/hungovercoders/site/blob/main/AGENTS.md) for the deploy model and the per-post share-image convention, predicted three gotchas based on what it found, then walked through the install accordingly. The whole skill trio — `slopstopper-install`, `slopstopper-update`, `slopstopper-triage` — lives in the [slopstopper repo](https://github.com/hungovercoders/slopstopper); installation is documented at [slopstopper.dev](https://slopstopper.dev). Treat the skill as the pre-flight half of a serious adoption; the curl is just the bit where files land.

## Last Orders Before the Push

The spine of a good install is two passes you run before opening the PR. Local dev catches every problem CI would catch, only faster, because there's no five-minute round trip while a runner spins up to tell you you've got the wrong indentation.

**Pass A — static.** No URL, no built site, runs in a few seconds:

```bash
task ss:hygiene:test                 # aggregate: docs-* + entry-files + csp-exceptions + complexity
task ss:security:secrets             # Gitleaks
task ss:security:sast                # Semgrep
task ss:security:vulnerability:all   # Trivy
```

![task ss:hygiene:test returning all six hygiene checks green](/assets/2026-06-15-slopstopper-on-tap/step-05-pass-a-green.png)

**Pass B — dynamic.** Built site, server on `:8080`, headers honoured by the same parser the platform uses:

```bash
npm run build
slopstopper serve &                                                       # auto-detects dist/client + public/_headers
task ss:reliability:smoke -- http://localhost:8080
task ss:reliability:accessibility -- http://localhost:8080
task ss:reliability:cwv -- http://localhost:8080
task ss:reliability:seo -- http://localhost:8080
task ss:reliability:broken-links -- http://localhost:8080
task ss:security:dast -- http://localhost:8080                            # OWASP ZAP, heaviest, needs Docker
```

![task ss:reliability:smoke green against localhost:8080 in 1.1s per page](/assets/2026-06-15-slopstopper-on-tap/step-06-pass-b-green.png)

The bundled `slopstopper serve` is the bit that quietly does a lot of work — it reads your `public/_headers` (Cloudflare's text format) on the fly, so the headers ZAP and the SEO check see are the same ones Cloudflare will eventually serve. No more "works locally, fails CI because the headers file was somewhere else."

## What Bit on the Way

Honest moment: a real site has shape, and shape catches on edges. Six things bit during this install. None of them were slopstopper bugs; all of them are the kind of thing every first-time install on a non-trivial site will surface. Worth naming them so you know what to expect.

1. **Two HIGH esbuild CVEs** sitting in the dev toolchain via transitive deps from Astro / Wrangler / Vite. Dependency vulnerability scan exited non-zero and refused to let me push. Fixed by pinning `esbuild: ">=0.28.1"` in `package.json` overrides — the patched version was already out, the tree just hadn't pulled it.
2. **A tutorial post tripped Gitleaks** on the documented Cosmos DB Emulator default account key. Microsoft publishes that key as a fixed value for local development. Allowlisted the file path in `.gitleaks.toml` with a comment that explains why future-me won't second-guess it.
3. **Five tutorial posts tripped ZAP's source-code-disclosure-SQL rule** because they include `SELECT` statements in `<pre><code>` blocks. ZAP's heuristic can't tell the difference between leaking SQL and teaching it. Added rule `10099` to `.zap/rules.tsv` with a `# why` line.
4. **GTM tripped ZAP's SRI rule** (90003) because the Google-served script doesn't ship a stable integrity hash. There's no version of that I can fix at the application layer; allowlisted with a `# why`.
5. **`BaseHead.astro` used `property="twitter:card"` everywhere instead of `name="twitter:card"`** — Twitter accepts either but the SEO check is strict on the canonical form, and the strict form is right. Five-line replace; rebuilt; green.
6. **The CSP needed a frame-src for `googletagmanager.com`** because GTM loads its preview frame on a separate origin. Tuned the existing `public/_headers` baseline; documented the script-src and style-src `'unsafe-inline'` relaxations in `docs/security/CSP_EXCEPTIONS.md` so the drift check stays happy.

Note the shape: every fix lives in *my* repo. None of them required editing slopstopper. That's the right divide — the tool's opinions are the tool's; the site's quirks are the site's; the drift check between them is where the two negotiate. Three of the six (esbuild, the twitter meta, the CSP frame-src) are things I'd want to know about regardless of whether I was installing a quality suite. Slopstopper just surfaced them.

## Eighteen on Tap

Pushed the branch. Eighteen checks green on the first run.

![GitHub PR checks page showing all eighteen slopstopper workflows passing on the first push](/assets/2026-06-15-slopstopper-on-tap/step-07-pr-checks.png)

The reason the first push went green is that local Pass A and Pass B are the same `task ss:*` invocations CI runs. There's no second-syntax surprise. Fix it locally, push, watch it confirm.

The Actions tab on the repo tells the same story from a different angle — each workflow with its own run, all of them passing on this branch, no separate "CI scripts" anywhere because the workflows just call `task`.

![GitHub Actions tab showing every slopstopper workflow with a successful run on the branch](/assets/2026-06-15-slopstopper-on-tap/step-08-pr-actions.png)

And inside any single run, every step is one of: install Task, install slopstopper-cli, install Node, install deps, then `task ss:<check>`. The DAST run is the heaviest of the suite (OWASP ZAP in a Docker container, spinning up the bundled local server, eighteen steps end-to-end) and it still finishes green:

![A single workflow run on GitHub showing all eighteen steps of the DAST job complete successfully](/assets/2026-06-15-slopstopper-on-tap/step-09-workflow-detail.png)

That's the whole pitch in a sentence: one Task invocation surface, run the same way locally, in CI, and in whatever shell-of-the-future ends up driving builds in three years.

## Would I Pour Another One

Yes. Tiny adopter footprint (`.ss/` is a near-empty marker), one invocation surface, eighteen gates running the same `task ss:<check>` commands in CI as I run locally. It's a clean separation between *what the tool does* and *what your repo carries* — exactly the right divide for slopping it onto more repos and not minding that they all stay in lockstep with the upstream.

One short caveat: if your repo is a monorepo with five sub-apps, the current shape assumes one set of pages to test, one set of URLs, one Cloudflare deployment. You can make it work but you're going to fight the defaults. Single-app repos are the sweet spot, and that's most of mine.

If you're staring at a repo where the quality gates have drifted and you can't remember which linter you turned off three months ago — `curl install.sh | bash` over the top of it and let the pre-flight tell you what'll bite. The honest list above is what one looked like for me. Yours will be different, but it'll be the same shape: things your repo already had, that you'll be glad to find out about.

Cheers, fellow hungovercoder. Pour one for the gate that catches the regression you didn't have to write a Slack thread about.
