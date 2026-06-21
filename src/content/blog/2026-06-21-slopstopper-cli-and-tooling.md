---
title: Stopping my AI Slop with Slopstopper CLI and Tooling
date: 2026-06-21
author: dataGriff
description: Installing slopstopper on hungovercoders.com — one command surface, twenty checks, and the honest truth about what bit on a real Astro site
tags:
  - Slopstopper
  - Astro
  - Cloudflare
  - Quality Gates
image:
  path: /assets/2026-06-21-slopstopper-cli-and-tooling/link.png
---

I was vibe coding more and more when a sudden dread started creeping up my spine as I decided to go live with some of them. Were they secure? Were they easy to maintain? Did I have a billion duplicated context tokens in my docs costing me a small fortune?? I didn't care up to this point as I was having too much fun building things... Then I realised I needed to collect some basic guardrails together to help me keep on top of this, which is where [slopstopper](https://slopstopper.dev) was born.

[slopstopper](https://slopstopper.dev) has become for me a portable suite of checks I can drop into any _fairly_ compatible repo, that runs the same `task ss:<check>` in CI as I run locally, and stops the slop at source before it ever ends up in a PR.

This post is a brief intro to what slopstopper is, how I installed it on hungovercoders and what I learned in the process.

## What is Slopstopper?

![Slopstopper](/assets/2026-06-21-slopstopper-cli-and-tooling/slopstopper.png)

Slopstopper is a Python CLI — [`slopstopper-cli`](https://pypi.org/project/slopstopper-cli/) on PyPI — backed by a check suite and twenty GitHub Actions workflows that all defer to `task ss:<check>` once installed. I lean on taskfile as part of the install as I want to ensure the local checks are _exactly_ the same commands that are run in CI.
It's dogfooded at the site [slopstopper.dev](https://slopstopper.dev), where every check in the suite runs against the slopstopper site itself; if a gate doesn't hold up on the tool's own marketing site, it doesn't ship to adopters. Same wheel, same workflows, same Task interface.

I built it because I kept forgetting things on new projects. The accessibility check I meant to add. The SEO meta-tags I'd promised myself I'd audit. The OWASP ZAP scan I kept rationalising as a phase-two job. The Lighthouse CI run that never made it past an overheard conversation. The Map Pattern for `docs/` that worked beautifully on one repo and never made it to the next. Four loops, one set of gates, one task surface — codify them once and stop having to remember.

| Loop               | What it does                                                                                   | Tools under the hood                   |
| ------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| 🔒 **Security**    | SAST, DAST, secrets, dependency CVEs, dependency review                                        | Semgrep, OWASP ZAP, Gitleaks, Trivy    |
| 🧹 **Hygiene**     | Complexity caps, doc structure / accuracy / size, entry-file budget, CSP drift, auto-label PRs | Lizard, custom Python, actions/labeler |
| ✅ **Reliability** | Smoke, accessibility (WCAG 2.1 AA), Core Web Vitals, SEO + OpenGraph, broken links             | Playwright, axe-core, Lighthouse CI    |
| 🤖 **Operations**  | Failed workflows auto-raise issues; an agentic doc updater opens weekly sync PRs               | GitHub Actions, gh-aw                  |

It is worth noting that the installation of slopstopper may not be perfect at this point and it is something I am working on. "It works on my repos" might be something I state too often in the not too distant future... but if nothing else it points you at a suite of tools and ideas that you can lean on, with the installation of slopstopper being a not bad starting point.

### Deployment and Branch URL Previews

I recently decided to consolidate on cloudflare as my deployment mechanism.
I am a big fan of PR branch previews which give me further confidence before merging to main. It means I can have an idea, tap it into claude code or copilot on my phone, and take a look at what that idea might look like in minutes. This isn't part of the slopstopper suite, but the PR preview URLs is something I have highlighted as something to lean on in AI development so humans can create slop... but take a look at it first!

![Cloudflare Branch URL Preview](/assets/2026-06-21-slopstopper-cli-and-tooling/cloudflare-preview-url.png)

## Calling Time on Command Divergence

The thing worth leading on is the invocation surface is via [taskfile](https://taskfile.dev/): **`task ss:<check>` is the only one there is**. Local dev, GitHub Actions, you running it on your laptop with a dry mouth and an overwhelming sense of guilt on a Sunday — same command, same output shape, one mental model. There's no separate CLI to learn for CI because the workflows themselves call `task` exactly the way you do.

It sounds small. It isn't. Its extremely important in the shift-left mentality of the world that you can recreate the CI pipeline checks locally identically so you can have confidence you have caught everything before the remote feedback loop begins. Using a consistent task runner as the interface for humans, agents and CI is a massive design victory to enable this. And because [mise](https://mise.jdx.dev/) pins the exact `slopstopper-cli` version in the repo, it isn't just the same command everywhere — it's the same version everywhere, so a check can't pass locally and fail in CI because the runner happened to grab a newer build.

## Downing the Slopstopper Install

The install is one curl — or one [Claude Code skill](#driving-it-with-a-skill) that drives it, if you'd rather walk through the pre-flight questions first. The curl is what ends up running either way:

```bash
curl -fsSL https://raw.githubusercontent.com/hungovercoders/slopstopper/main/install.sh | bash
```

That does two things. First, it pins the [`slopstopper-cli`](https://pypi.org/project/slopstopper-cli/) Python wheel — the CLI that carries every check, the Playwright suite, and the bundled local server — in a new `mise.toml` and installs it via [mise](https://mise.jdx.dev/), so the version your laptop runs is the exact version CI runs. Second, it seeds your repo with the thin layer that lets your project plug into the CLI: `Taskfile.ss.yml` (the canonical adopter interface — every check is a task here), `mise.toml` (the toolchain pin for `slopstopper-cli` and `task`), twenty `ss-*.yml` workflows under `.github/workflows/`, devDeps for Playwright + Lighthouse CI + axe-core + markdownlint merged into `package.json`, and a `.slopstopper.yml` for you to fill in with your URLs, your pages, and where your security headers live.

![The install.sh banner at the start of the run — pinning and installing slopstopper-cli via mise and reporting the source + target paths](/assets/2026-06-21-slopstopper-cli-and-tooling/step-01-preflight.png)

By the time it finishes, you've got a status block that names every file it touched and tells you which checks are active out of the box, which ones need config, and which ones are inert until you wire secrets in. No guessing what landed.

![The install.sh status block at the end of the run — which checks are active out of the box, which need config, and which stay inert](/assets/2026-06-21-slopstopper-cli-and-tooling/step-02-install-output.png)

All the config that landed — Taskfile, twenty workflows, `.slopstopper.yml`, the security headers block, the ZAP allowlist, the devDeps in `package.json` — is exactly what it should be: visible, owned, easy to read, the bit _you_ tune. The check logic itself sits inside the CLI where you don't have to look at it. `.ss/` ends up as a near-empty marker directory (just `.workflows-installed` plus a gitignored `reports/`), and because the CLI version is pinned in `mise.toml`, picking up a new slopstopper release is a deliberate one-line bump — `install.sh --upgrade-cli` moves the pin; a plain re-run honours it and never surprises you. Every adopter gets the new behaviour without a single line moving in their tree, no copy-paste, no per-repo drift, no merge conflicts on tool internals when you pull from upstream.

After the install, configure `.slopstopper.yml` (URLs, page lists, headers source path) and push the Node version pin into a GitHub repo variable:

```bash
gh variable set SLOPSTOPPER_NODE_VERSION --body 22
```

A quick `slopstopper doctor` confirms every external tool the suite needs is on PATH — Node, Task, Docker for OWASP ZAP, Python for the Trivy + Lizard backbone. Anything missing is named, with the command to fix it. Run it once after install; you shouldn't need to run it again unless you change your dev box.

![slopstopper doctor showing every required tool found and reachable](/assets/2026-06-21-slopstopper-cli-and-tooling/step-04-doctor.png)

Then you're done seeding. From here on it's the local loop.

## Driving It With a Skill

The install is one curl. The hard bit is having the right answers ready: where your build writes to, what Node version you need, whether your headers live in `public/_headers` or `worker/headers.json`, whether you ship a site-wide `/og-image.png` or per-post share images. I also built a [Claude Code](https://claude.com/claude-code) skill — `slopstopper-install` — that asks those twelve questions for you, reads the answers straight out of your repo where it can, then drives the installer, configures `.slopstopper.yml`, sets up the `docs/` Map Pattern, and runs the local Pass A and Pass B until they're both green. By the time CI runs on the PR, it's a confirmation pass, not a discovery pass.

I drove that skill for this install. It read [`AGENTS.md`](https://github.com/hungovercoders/site/blob/main/AGENTS.md) for the deploy model and the per-post share-image convention, predicted three gotchas based on what it found, then walked through the install accordingly. Both skills — `slopstopper-install` and `slopstopper-triage` — live in the [slopstopper repo](https://github.com/hungovercoders/slopstopper); installation is documented at [slopstopper.dev](https://slopstopper.dev). Treat the skill as the pre-flight half of a serious adoption; the curl is just the bit where files land.

## Last Orders Before the Push

The spine of a good install is two passes you run before opening the PR. Local dev catches every problem CI would catch, only faster, because there's no five-minute round trip while a runner spins up to tell you you've got the wrong indentation.

**Pass A — static.** No URL, no built site, runs in a few seconds:

```bash
task ss:hygiene:test                 # aggregate: docs-* + entry-files + csp-exceptions + complexity
task ss:security:secrets             # Gitleaks
task ss:security:sast                # Semgrep
task ss:security:vulnerability:all   # Trivy
```

![task ss:hygiene:test returning all six hygiene checks green](/assets/2026-06-21-slopstopper-cli-and-tooling/step-05-pass-a-green.png)

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

![task ss:reliability:smoke green against localhost:8080 in 1.1s per page](/assets/2026-06-21-slopstopper-cli-and-tooling/step-06-pass-b-green.png)

The bundled `slopstopper serve` is the bit that quietly does a lot of work — it reads your `public/_headers` (Cloudflare's text format) on the fly, so the headers ZAP and the SEO check see are the same ones Cloudflare will eventually serve. No more "works locally, fails CI because the headers file was somewhere else."

## What we found on Hungovercoders

What did we find on hungovercoders? A revamped website in its infancy, surely not much could have gone off track in such a short space of time..?

Seven things bit during this install. None of them were slopstopper bugs; all of them are the kind of thing every first-time install on a non-trivial site will surface. Worth naming them so you know what to expect.

1. **Two HIGH esbuild CVEs** sitting in the dev toolchain via transitive deps from Astro / Wrangler / Vite. Dependency vulnerability scan exited non-zero and refused to let me push. Fixed by pinning `esbuild: ">=0.28.1"` in `package.json` overrides — the patched version was already out, the tree just hadn't pulled it.
2. **A tutorial post tripped Gitleaks** on the documented Cosmos DB Emulator default account key. Microsoft publishes that key as a fixed value for local development. Allowlisted the file path in `.gitleaks.toml` with a comment that explains why future-me won't second-guess it.
3. **Five tutorial posts tripped ZAP's source-code-disclosure-SQL rule** because they include `SELECT` statements in `<pre><code>` blocks. ZAP's heuristic can't tell the difference between leaking SQL and teaching it. Added rule `10099` to `.zap/rules.tsv` with a `# why` line.
4. **GTM tripped ZAP's SRI rule** (90003) because the Google-served script doesn't ship a stable integrity hash. There's no version of that I can fix at the application layer; allowlisted with a `# why`.
5. **`BaseHead.astro` used `property="twitter:card"` everywhere instead of `name="twitter:card"`** — Twitter accepts either but the SEO check is strict on the canonical form, and the strict form is right. Five-line replace; rebuilt; green.
6. **The CSP needed a frame-src for `googletagmanager.com`** because GTM loads its preview frame on a separate origin. Tuned the existing `public/_headers` baseline; documented the script-src and style-src `'unsafe-inline'` relaxations in `docs/security/CSP_EXCEPTIONS.md` so the drift check stays happy.
7. **No documentation pattern.** Slopstopper enforces a consistent documentation pattern where AGENTS, CLAUDE and README become thin pointers to a docs/index.md file. The skill we invoked to install slopstopper forced this pattern and ensured this index map pattern was used. This means less tokens are used during agent invocations because the index helps agents read only the files they need.

Note the shape: every fix lives in _my_ repo. None of them required editing slopstopper. That's the right divide — the tool's opinions are the tool's; the site's quirks are the site's; the drift check between them is where the two negotiate. Three of the seven (esbuild, the twitter meta, the CSP frame-src) are things I'd want to know about regardless of whether I was installing a quality suite. Slopstopper just surfaced them.

## Eighteen Checks on Tap

I then pushed the branch once the installation was complete and all of the fixes were in place. Twenty workflows ship; the two operational ones (the failure auto-reporter and the agentic doc updater) only fire on failure or schedule, so a clean PR shows eighteen — and all eighteen went green on the first push.

![GitHub PR checks page showing all eighteen slopstopper workflows passing on the first push](/assets/2026-06-21-slopstopper-cli-and-tooling/step-07-pr-checks.png)

The reason the first push went green is that local Pass A and Pass B are the same `task ss:*` invocations CI runs. There's no second-syntax surprise. Fix it locally, push, watch it confirm.

The Actions tab on the repo tells the same story from a different angle — each workflow with its own run, all of them passing on this branch.

![GitHub Actions tab showing every slopstopper workflow with a successful run on the branch](/assets/2026-06-21-slopstopper-cli-and-tooling/step-08-pr-actions.png)

And inside any single run, every step is one of: set up the mise toolchain (the pinned `slopstopper-cli` and `task` in one go), install Node, install deps, then `task ss:<check>`. The DAST run is the heaviest of the suite (OWASP ZAP in a Docker container, spinning up the bundled local server) and it still finishes green end-to-end:

![A single DAST workflow run on GitHub — the OWASP ZAP job green end-to-end](/assets/2026-06-21-slopstopper-cli-and-tooling/step-09-workflow-detail.png)

Eighteen steps, eighteen greens, no surprises — because there were no surprises left for CI to surface.

## What happens if there is drift or a live issue?

Luckily slopstopper also comes with scheduled runs. This keeps on top of things like smoke tests which raises issues and emails me if there are live issues. These are the exact same checks that run in CI, which are the same checks that run locally... because they are all driven by the taskfile command interface. This pattern is driven by the slopstopper on failure action which reacts to any failed pipeline in a consistent manner.

![Slopstopper Issue Raised](/assets/2026-06-21-slopstopper-cli-and-tooling/slopstopper-issue.png)

The other nice thing about this pattern is that it also auto closes the issue once the offending pipeline is fixed.

While I wouldn't usually use github actions for this type of reliability work, its good enough for me and my personal projects. It means I don't need to bring in other tools whilst paying credence to the fact reliability should be a concern for me.

**Important note** If you're using private repos slopstopper may not be a great fit for you because it will in its current state consume a fair bit of action minutes. Public repos are fine to use as its all free, but private repos will incur action minutes charges. I will need to work on finding more efficient ways to invoke slopstopper no doubt.

## Would I Pour Another One

Yes. For me its really useful to get these quality gates in place to catch regressions before they become long-term technical debt. It also gives me at least some peace of mind that I am attempting to consider security and reliability as part of the development process - which is just too darn fun at the moment with AI to keep remembering the important stuff.

If your repo is a monorepo with five sub-apps, the current shape assumes one set of pages to test, one set of URLs, one Cloudflare deployment. You can make it work but you're going to fight the defaults. Single-app repos are the sweet spot, and that's most of mine.

## What next?

I definitely want to keep working on slopstopper, even if the install is a bit niche, I like to keep it as a reference point for what expectations we should have and what tools there are out there to help us meet those expectations. I'll definitely roll it out to the rest of my sites for peace of mind and try to think of even simpler ways to gain confidence in our AI accelerated workflows. Going to production definitely changes your perspective and what is important and hopefully slopstopper brings them to the surface quicker.

Any ideas you may have please post them at [slopstopper.dev/feedback](https://slopstopper.dev/feedback) and we'll see if we can all save the world from slop!
