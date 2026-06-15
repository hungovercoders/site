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

I wanted a quality gate I could pour straight into any repo and stop the slop at source — not a slack thread of half-remembered linters I keep forgetting to copy into the next project. So I dropped [slopstopper](https://slopstopper.dev) onto the only place I'd notice a regression first: this site. Astro 6 on Cloudflare Workers, a blog stuffed with code samples, an Open Graph image per post, the usual GTM container in the head. If it's going to bite anywhere, it's going to bite here.

This post is the walk through that install. The canonical docs live at [slopstopper.dev](https://slopstopper.dev); this is the path through them on a real site, with the bits that bit me on the way.

![The slopstopper install banner mid-stream, showing the canonical Task invocation message at the bottom](/assets/2026-06-15-slopstopper-on-tap/step-02-install-output.png)

## Five Loops, One Bar

The pitch is one short table:

| Loop | What it does | Tools under the hood |
| --- | --- | --- |
| 🔒 **Security** | SAST, DAST, secrets, dependency CVEs, dependency review | Semgrep, OWASP ZAP, Gitleaks, Trivy |
| 🧹 **Hygiene** | Complexity caps, doc structure / accuracy / size, entry-file budget, CSP drift, auto-label PRs | Lizard, custom Python, actions/labeler |
| ✅ **Reliability** | Smoke, accessibility (WCAG 2.1 AA), Core Web Vitals, SEO + OpenGraph, broken links | Playwright, axe-core, Lighthouse CI |
| 🤖 **Operations** | Failed workflows auto-raise issues; an agentic doc updater opens weekly sync PRs | GitHub Actions, gh-aw |
| 🚀 **Deployment** | Preview per PR, prod on merge, preview cleanup on close | Cloudflare Workers Builds |

Deployment sits outside slopstopper — Cloudflare's Git integration handles it, no GitHub Actions involvement, no secrets dance. The other four loops are the suite proper.

## Calling Time on Two Syntaxes

The thing I want to lead on is what's different about this version: **`task ss:<check>` is the only invocation surface there is**. Local dev, GitHub Actions, you running it on your laptop at half eleven on a Tuesday — same command, same output shape, one mental model. There's no separate CLI to learn for CI because the workflows themselves call `task` exactly the way you do.

It sounds small. It isn't. Every quality-suite I've ever bolted onto a repo has had two flavours of invocation — the one CI uses, and the one humans use — and the two slowly diverge until something fails on CI that's green locally and you spend a wet Wednesday afternoon working out why. Closing time on that whole class of problem is, by itself, worth the install.

`slopstopper doctor` is the first thing I'd run on a new box. It tells you what's reachable, what isn't, and what to install if it isn't.

![slopstopper doctor showing every required tool found and reachable](/assets/2026-06-15-slopstopper-on-tap/step-04-doctor.png)

## Pouring the First Pint

The install is one curl:

```bash
curl -fsSL https://raw.githubusercontent.com/hungovercoders/slopstopper/main/install.sh | bash
```

That seeds `Taskfile.ss.yml` (the canonical adopter interface — every check is a task here), drops twenty `ss-*.yml` workflows under `.github/workflows/`, merges devDeps for Playwright + Lighthouse CI + axe-core + markdownlint into `package.json`, and writes a `.slopstopper.yml` for you to fill in with your URLs, your pages, and where your security headers live.

The pre-flight summary is the bit I'd want to print and stick on the wall — twelve questions about your repo answered before a single file lands. Node version, deploy model, headers format, whether you ship a site-wide `/og-image.png`, whether you have GHAS, whether your Taskfile already includes other taskfiles. Cheap, anticipatory, exactly the kind of thing a new tool ought to do.

![The slopstopper-install skill's pre-flight summary running through twelve checks before the install starts](/assets/2026-06-15-slopstopper-on-tap/step-01-preflight.png)

What you don't get any more is half the wheel. Slopstopper used to copy its check scripts into adopter repos under `.ss/scripts/` and its Playwright suite under `.ss/tests/`. Now both ship inside the Python wheel and `.ss/` is just `reports/` (gitignored output) and `.workflows-installed` (a manifest of what landed so re-runs respect anything you've deleted). When the wheel updates, every adopter gets the new check logic — no copy-paste, no per-repo drift.

![ls -la .ss/ showing just .workflows-installed — the entire check logic now lives in the wheel](/assets/2026-06-15-slopstopper-on-tap/step-03-tiny-ss-dir.png)

After the install, configure `.slopstopper.yml` (URLs, page lists, headers source path) and push the Node version pin into a GitHub repo variable:

```bash
gh variable set SLOPSTOPPER_NODE_VERSION --body 22
```

Then you're done seeding. From here on it's the local loop.

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

## Would I Pour Another One

Yes. The `.ss/` directory being a near-empty marker is a category leap from where this tool started — the check logic lives in the wheel, the workflows defer to Task, the adopter repo carries config and headers and not much else. When slopstopper updates, every site running it gets the new behaviour without a single line moving in adopter repos.

One short caveat: if your repo is a monorepo with five sub-apps, the current shape assumes one set of pages to test, one set of URLs, one Cloudflare deployment. You can make it work but you're going to fight the defaults. Single-app repos are the sweet spot, and that's most of mine.

If you're staring at a repo where the quality gates have drifted and you can't remember which linter you turned off three months ago — `curl install.sh | bash` over the top of it and let the pre-flight tell you what'll bite. The honest list above is what one looked like for me. Yours will be different, but it'll be the same shape: things your repo already had, that you'll be glad to find out about.

Cheers, fellow hungovercoder. Pour one for the gate that catches the regression you didn't have to write a Slack thread about.
