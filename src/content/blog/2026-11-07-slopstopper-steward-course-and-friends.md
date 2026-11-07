---
title: Slopstopper Five Months On, with a Steward, a Course and Twenty-Five Checks
date: 2026-11-07
author: dataGriff
description: Twenty-five checks, a profile per repo shape, a course on a slopped demo, and a steward that keeps every repo current, five months after the first install
tags:
  - Slopstopper
  - Steward
  - Quality Gates
  - Software Factory
  - Claude Code
  - Dependabot
image:
  path: /assets/2026-11-07-slopstopper-steward-course-and-friends/link.png
---

I wanted [slopstopper](https://slopstopper.dev) to look after itself. Not on this site, it already does that, but on every repo I've got, on the current version, without me being the one who remembers to bump a pin on a Sunday with a head on me. Back in [June](/blog/2026-06-21-slopstopper-cli-and-tooling/) I installed it here and wrote up the seven things it found. It's November now, there are twenty-five checks, there's a course, and there's a second tool called the [steward](https://github.com/hungovercoders/slopstopper-steward) that does the rounds of my repos so I don't have to. Read on fellow hungovercoder and meet the robot that nags the other robots.

## The Bouncer on the Door

I barely type code any more. I tap an idea into Claude Code on my phone, an agent writes it, a pull request turns up, and I'm reading a diff I didn't write. It's brilliant fun and it's also a factory, and a factory with nobody on inspection ships slop.

The agent is the punter: creative, chatty, and a different answer every time you ask. Slopstopper is the bouncer. Same question, same answer, whoever's asking. That's why it's Semgrep, Gitleaks, Trivy, Lizard, axe-core and Lighthouse doing the checking and not a model having a guess. It's why a check that couldn't run says so and exits 2, instead of exiting 0 and waving the whole queue in. And it's why the `task ss:<check>` on my laptop is the same command and the same pinned version as CI, with a red line that names a file and a report so I can hand it to an agent to fix.

![Three boxes left to right: generators (agents writing code, a different answer every time), gates (slopstopper, twenty-five deterministic checks in three loops, the same task command locally and in CI, exiting 0 for clean, 1 for found something, 2 for could not run) and what ships (the PR merges, Cloudflare deploys). A steward band beneath loops back into the gates, keeping every repo on the current version and working the issues the gates raise](/assets/2026-11-07-slopstopper-steward-course-and-friends/factory.svg)

Here's the loop in one go, recorded with [vhs](https://github.com/charmbracelet/vhs) from the tapes slopstopper keeps in its repo. A check goes green, a routing table gets pasted into the README because "people read the README", the check goes red and points at the report, the change gets reverted, green again.

<video autoplay loop muted playsinline>
  <source src="/assets/2026-11-07-slopstopper-steward-course-and-friends/triage.mp4" type="video/mp4">
  <source src="/assets/2026-11-07-slopstopper-steward-course-and-friends/triage.webm" type="video/webm">
  <img src="/assets/2026-11-07-slopstopper-steward-course-and-friends/triage.gif" alt="The triage loop in a terminal: task ss:hygiene:entry-files passes, a routing table is pasted into README.md, the same check fails naming the file and its token budget, the report under .ss/reports is read, the change is reverted and the check passes again">
</video>

## What's on Tap Now

The June table is wrong in most cells now, so here's the current one.

| Loop | Checks | Tools under the hood |
| --- | --- | --- |
| 🔒 **Security** | SAST, DAST, secrets, dependency CVEs, dependency review, licence inventory, API headers and CORS | Semgrep, OWASP ZAP, Gitleaks, Trivy, GitHub dependency review |
| 🧹 **Hygiene** | Complexity caps, docs structure, accuracy and size, entry-file budgets, CSP drift, privacy statement, OpenAPI drift, auto-label PRs | Lizard, the CLI's own Python, actions/labeler |
| ✅ **Reliability** | Smoke, E2E journeys, accessibility (WCAG 2.1 AA), Core Web Vitals, SEO and social metadata, broken links, robots.txt, sitemap, llms.txt, API health and latency | Playwright, axe-core, Lighthouse CI, the CLI |
| 🤖 **Operational** | One rolling PR summary comment, failed workflows raise and close their own issue, the Cloudflare post-deploy run, a weekly doc updater, release-please | GitHub Actions, gh-aw |

The robots, sitemap and llms.txt checks are there because I kept shipping a sitemap that didn't match the pages, and once shipped a robots file that de-indexed production. The CVE scan now re-runs on main every Monday, because a quiet repo never used to hear about a CVE that came out after its last push, and most of mine are quiet.

## Pick Your Poison: ui, api or library

June's install assumed everything was a website, so when I put it on an API nine browser checks fell over instead of staying out of the way. There are three profiles now. `ui` is the default and gives you the lot, holding the API checks back until the repo shows an API. `api` drops the browser and SEO checks and runs DAST in ZAP's OpenAPI mode. `library` is static checks only, and is what the steward itself runs on.

```bash
curl -fsSL https://raw.githubusercontent.com/hungovercoders/slopstopper/main/install.sh | bash -s -- --profile api
```

`slopstopper profile show` tells you which profile you're on and which workflows it's deliberately not carrying, because a missing workflow used to look like a broken install and I'd go hunting for a bug that wasn't there.

![slopstopper profile detect suggests ui because it found app/feedback.html, and profile show lists the four API workflows the ui profile deliberately leaves out](/assets/2026-11-07-slopstopper-steward-course-and-friends/profile.png)

## One Comment, Not Twenty

Twenty-five workflows each posting their own comment is a PR nobody reads, including me. Each check now only comments while it's red and deletes the comment when it goes green, and one summary comment per PR says where everything stands. This is the one on the PR that moved this site to 0.29.0 this week.

![The single SlopStopper summary comment on this site's pull request 83: all 20 checks passed, listed by loop, with the head commit and the time it was last updated](/assets/2026-11-07-slopstopper-steward-course-and-friends/pr-summary.png)

A green PR has that line and nothing else. It looks like the install has broken until you get used to it.

## Break Lantern, Not Production

The thing I wanted most in June was a way to show someone each check without breaking a real repo. The CLI now writes you one to break.

```bash
pipx install slopstopper-cli
slopstopper demo        # writes slopstopper-demo/, a two-page status page called Lantern
```

<video autoplay loop muted playsinline>
  <source src="/assets/2026-11-07-slopstopper-steward-course-and-friends/demo.mp4" type="video/mp4">
  <source src="/assets/2026-11-07-slopstopper-steward-course-and-friends/demo.webm" type="video/webm">
  <img src="/assets/2026-11-07-slopstopper-steward-course-and-friends/demo.gif" alt="slopstopper demo writing twenty-three files to slopstopper-demo and listing the ten checks that fail on it on purpose, each with the command to run and the finding it will report">
</video>

Lantern is a little status page with one deliberate finding per check: a complexity hotspot, a README over budget, a missing header, a requests pin from 2018 with a CVE on it. The one thing it doesn't carry is a secret, because a realistic-looking key in a public repo gets found by every scanner on the internet and reported to the vendor. That lesson has you write your own fake one.

On top of the demo is the course, [From zero to slopstopper](https://slopstopper.dev/learn): twenty-one short lessons, one check or one idea each, with a YouTube episode to come for every one. Every command in every lesson runs in CI, which I added after lesson 4's commands rotted while I was writing lesson 5. The two Claude Code skills from June, `slopstopper-install` and `slopstopper-triage`, now ship inside the CLI, so when the pin moves the playbook the agent reads moves with it.

![The From zero to slopstopper course page on slopstopper.dev: twenty-one short lessons, what you will need, and the four commands that install the CLI and write the Lantern demo repo](/assets/2026-11-07-slopstopper-steward-course-and-friends/learn.png)

## The Steward Does the Rounds

Slopstopper is per-repo, and I've got it on a handful of repos. Every release meant a round of pin bumps and refreshes and release notes in each one, every red check on main was an issue in each one, and every Dependabot PR was a green tick waiting for me to press the button. I built the tool so I'd stop forgetting the important stuff, and then forgot to keep the tool current.

So I built [slopstopper-steward](https://github.com/hungovercoders/slopstopper-steward) to do the round for the whole org. It has no check logic and no fix knowledge of its own. Slopstopper decides what's wrong in a repo and ships the skill that says how to fix it; the steward works out which repos need a hand and points slopstopper's own tooling at them, one PR each. The rule is the bouncer rule again: code for anything with a right answer, an agent only where there's a judgement to make. The agent gets two jobs, reading a refresh to tell me if a knob moved or a workaround can come out, and fixing a check that's gone red, and everything it touches goes back through the gates before anything is pushed.

![One steward run as a pipeline of seven steps: discover, inventory, plan, execute, self-review, settle and report. Five are plain code. Execute and settle hand two judgement calls, reading a refresh and fixing a red check, to a boxed Claude Code agent with its own OS user, no token and no network. Whatever it changes goes back up through the gates, the pinned CLI's checks and then the pull request's own CI, before anything is pushed](/assets/2026-11-07-slopstopper-steward-course-and-friends/steward-run.svg)

I didn't want an agent anywhere near a push token, so it doesn't get one. It runs as its own OS user in its own copy of the clone, with no network, a tool allow-list, a dollar cap and a turn cap, and it never gets a vote on whether its own change passes. Which model does the judging is one line in `steward.yml`, passed straight to `claude --model`. Mine says `sonnet` and so far Sonnet has been really cheap for this: twelve cents to read a refresh and change nothing, twenty to read one and write up why nothing needed changing, thirty to find a function over the complexity ceiling, split it and have a second run review the split. Every PR body says which model ran and what it cost.

### Dependabot's Round

Dependabot opens the bump and the steward waits for the checks. If they're red, the agent gets the failing job's log and the release notes, with a brief that says adapt the repo to the new version and never loosen a test or pin it back, and the fix goes onto Dependabot's own branch with one comment saying what happened. Green patch and minor bumps get merged by the same run. Majors get listed for a human.

The first run merged six Dependabot PRs across two repos in under five minutes and left two alone with a comment each. No agent was involved in any of the six. A green bump is a yes or no question, and a model would only have slowed it down.

### The 0.29.0 Round

When 0.29.0 shipped this week the steward moved three repos to it in one run. On apic the agent read the refresh, found no new knobs, and found the complexity check red on a function in the VS Code extension at CCN 32 against a ceiling of 30. It split the function, the self-review approved, all forty-six checks on the PR went green, and the PR body says all of that with the model, the cost ($0.22 for the work, $0.08 for the review) and the one command the box refused to let it run. This site was another of the three: the agent found nothing to change, said so, and all I did was press merge.

![This site's pull request 83, opened by the steward bot: the pin moved from 0.26.0 to 0.29.0, the agent's account of the refresh with the model, cost and turn count, the browser checks it left to the PR's own workflows, and the line saying all thirty checks are green](/assets/2026-11-07-slopstopper-steward-course-and-friends/steward-pr.png)

## What Went Wrong, Again

Seven things in June. Five this month, in the order they bit me.

1. **The installer added devDependencies to `package.json` and left `package-lock.json` alone.** Every browser workflow starts with `npm ci`, which refuses a stale lock, so the first upgrade the steward ever opened went red on ten checks at once. Both the steward and the 0.29.0 installer regenerate the lock now.
2. **The steward timed the wait for PR checks from when it looked, not from when they'd finished.** On Dependabot PRs that had been green for a week, that was five minutes each of waiting for nothing.
3. **A cancelled CI job counted as red**, so the agent got handed a job with no log and spent a round working out there was nothing to read.
4. **Semgrep wouldn't run inside the agent's box.** The GitHub runner image puts `XDG_CONFIG_HOME=/home/runner/.config` in `/etc/environment`, sudo's PAM session reads that back in, and Semgrep tried to write its settings somewhere the agent user couldn't.
5. **The Claude API key hit its monthly spend limit** halfway through the run. The install and every check still ran, and the PR opened as a draft saying the agent hadn't finished. The agent is the only part of this with a bill.

None of these were in the checks. All of them were in the machinery around the checks, and every one of them showed up only when I ran it against real repos.

## Would I Pour Another One

Yes, more than in June. The checks were already worth it. The steward turns them from a thing I have to remember into a thing that just happens, and the course means I can hand slopstopper to somebody without a two-hour call and a whiteboard. It's still too darn fun with AI at the moment to keep remembering the important stuff, so I'd rather the important stuff remembered itself.

The June caveats stand. Private repos will burn Actions minutes. Monorepos fight the defaults. And the steward's agent costs real money, pennies per PR, but it's a budget you set and a limit you will hit.

If I were doing this again I'd have pointed the steward at real repos a week earlier and written less of it first. None of the five things that went wrong were in the checks, and I'd never have thought to write a test for a PAM session reading `/etc/environment`.

## Sources and Further Reading

This post is the guided path. These are the sources.

- [slopstopper.dev](https://slopstopper.dev) for the install one-liner, the checks and the profiles, and [From zero to slopstopper](https://slopstopper.dev/learn) for the course.
- The [slopstopper repo](https://github.com/hungovercoders/slopstopper) and its [changelog](https://github.com/hungovercoders/slopstopper/blob/main/CHANGELOG.md), where 0.26.0 to 0.29.0 is the stretch this post covers.
- The [steward repo](https://github.com/hungovercoders/slopstopper-steward) and its [architecture doc](https://github.com/hungovercoders/slopstopper-steward/blob/main/docs/architecture/README.md), where the box and the settle loop are written up in full.
- [The June post](/blog/2026-06-21-slopstopper-cli-and-tooling/), for where this started.

## What Next

The steward's own upgrade PRs still wait for me to press merge, until I've read enough of its self-reviews to trust the switch. And there are twenty-one episodes to record, in between meals.

Ideas and complaints to [slopstopper.dev/feedback](https://slopstopper.dev/feedback) as ever, and let's see if we can all save the world from slop. Cheers fellow hungovercoder!
