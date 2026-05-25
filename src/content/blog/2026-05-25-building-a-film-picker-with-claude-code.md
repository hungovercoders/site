---
title: "Building a Film Picker with Claude Code"
date: 2026-05-25
author: dataGriff
description: "A short tour of Claude Code's eleven moving parts plus a twenty-minute three-file kit that picks a film by mood — built from a CLAUDE.md, a custom skill, and a JSON-validating hook"
tags: [claude-code, ai, hungovercoders]
---

I've been meaning to write up Claude Code properly for a while now. I've been using it daily for about six months, built three personal kits with it, shipped an 11-lesson tutorial off the back of it — and yet no single post that says *"here's what's in the box and here's one small thing you can build today"*. So that's this post. The tour of what Claude Code actually ships first, then a twenty-minute kit that picks a film for the evening — partly because *The Mandalorian and Grogu* at the cinema yesterday left me with a film-shaped problem on the brain, and partly because the kit shape generalises to anything you do more than twice a week.

The thing I want to land is the *composition*. Claude Code is the kit, not any one feature. Most of the AI-tool posts out there pick a single feature, demo it in isolation, and call it a tutorial. That's how you end up using 10% of the tool. This post builds something three features deep — the same shape my real workflows use — so when you walk away you've got a working pattern, not just a working example.

## Pre-Requisites

- macOS, Linux, or Windows (with WSL)
- A Claude.ai Pro account (Claude Code isn't on the free tier)
- A terminal you actually like — iTerm2, Warp, Ghostty
- `jq` installed (`brew install jq` on macOS, `apt install jq` on Debian/Ubuntu)
- About twenty minutes

## What's On the Programme

The full series at [hungovercoders.com/training/claude-code](https://hungovercoders.com/training/claude-code) has eleven lessons. Here's what Claude Code actually ships, one sentence each:

- **Permissions and safety** — the bouncer at the door. Five permission modes, four config layers, deny rules that win over allow rules.
- **CLAUDE.md** — the recipe card the agent reads at the start of every session. Project context, conventions, things to never do.
- **Plan mode** — read-only thinking gear that writes a plan before touching a single file. Stops the agent vibing at your codebase.
- **Custom slash commands** — single markdown files that turn a repeated prompt into a one-line `/name` invocation. Still supported.
- **Skills** — the modern shape: a directory with `SKILL.md` and optional supporting files, fired by the same `/name` interface. New functionality lands here first.
- **Hooks** — shell scripts at lifecycle events (PreToolUse, PostToolUse, UserPromptSubmit). The bit that *enforces* what `CLAUDE.md` only *suggests*.
- **Subagents** — junior Claudes spawned via the Task tool, each in their own context window. Great for parallel work and context protection.
- **MCP servers** — the tap to external systems. Wire in GitHub, Postgres, the filesystem, or anything that speaks the Model Context Protocol.

Today's kit uses three of these — `CLAUDE.md`, a custom skill, and a hook — composed into one small CLI that earns its keep on a film night and generalises to a hundred other workflows.

## Buying the Ticket

One curl puts the binary on your machine.

```bash
curl -fsSL https://claude.ai/install.sh | sh
```

The script drops a code-signed `claude` binary in `~/.local/bin` and adds it to your PATH. Open a new terminal tab, then:

```bash
claude --version
```

First `claude` invocation opens a browser for OAuth. Sign into Claude.ai, terminal picks up the token, you're authenticated.

```text
✓ Authenticated as mando@rebelalliance.com
```

Three minutes, cold machine to authenticated session. Now the kit.

## The Plot in Three Files

The CLI we're building fits on a beermat. Pass it a mood ("fun", "cardiff", "homesick"), it picks a film from a local JSON catalogue and prints it. Two files of code, one data file, all under thirty lines total.

```bash
mkdir -p ~/dev/pick-film && cd ~/dev/pick-film
```

The data and the picker script first:

`~/dev/pick-film/films.json`:

```json
[
  { "title": "The Mandalorian and Grogu", "year": 2026, "mood": "fun",      "runtime": 105 },
  { "title": "Twin Town",                  "year": 1997, "mood": "cardiff",  "runtime": 99  },
  { "title": "How Green Was My Valley",    "year": 1941, "mood": "homesick", "runtime": 118 },
  { "title": "Hedd Wyn",                   "year": 1992, "mood": "wales",    "runtime": 123 },
  { "title": "Hot Fuzz",                   "year": 2007, "mood": "comedy",   "runtime": 121 }
]
```

`~/dev/pick-film/pick-film.sh`:

```bash
#!/bin/bash
mood="${1:-fun}"
jq -r --arg m "$mood" '
  [.[] | select(.mood == $m)] |
  if length == 0 then "No film for mood: \($m). Try another."
  else (.[0] | "\(.title) (\(.year)) — \(.runtime)min")
  end
' films.json
```

```bash
chmod +x ~/dev/pick-film/pick-film.sh
./pick-film.sh fun
```

```text
The Mandalorian and Grogu (2026) — 105min
```

Eight lines of bash, five films in JSON. That's the whole CLI. The Claude Code features now wrap around it — context, workflow, guardrail.

## Opening Scene — `CLAUDE.md`

The first Claude Code piece is `CLAUDE.md`. It's the project context the agent reads on every session in this directory. Anything in here is part of every conversation about this folder. We use it to encode the rules of the kit.

`~/dev/pick-film/CLAUDE.md`:

```markdown
# pick-film — agent context

## What this is

A tiny CLI for picking a film to watch tonight by mood. Bash + jq +
a JSON catalogue. No Python, no Node, no dependencies beyond jq.

## Files

- `films.json`   — array of `{title, year, mood, runtime}` objects.
                   Append new films to the end; never reorder.
- `pick-film.sh` — the picker script. One argument (a mood) → one
                   matching film.

## Conventions

- Moods are single lowercase words ("fun", "homesick", "cardiff",
  "cosy", "comedy", "wales", "big-night").
- Welsh and modern releases preferred. Twin Town, Hedd Wyn, How
  Green Was My Valley, anything Mandalorian.
- Runtime in minutes (integer). Year is a four-digit integer.

## Adding films

Either edit `films.json` directly, or use the `/add-film` skill —
`/add-film "Title" 2026 mood 105`.
```

Forty lines of plain English. Every session in this folder now starts with these rules in context. The agent doesn't need to be told the data shape or the conventions — they're already loaded.

## The Mid-Reel Twist — An `/add-film` Skill

The second piece is a **skill**. Skills can live at **user level** (`~/.claude/skills/`, available from every directory on the machine) or **project level** (`.claude/skills/`, sitting inside the project itself). Both produce the same `/name` invocation — the difference is *reach*. User-level skills are for cross-cutting tools you want everywhere: a `/lint` skill, a `/standup` skill, a `/review` skill that applies to any codebase. Project-level skills are for tools that only make sense inside *this one project* — and `/add-film` is exactly that, because it does nothing useful unless there's a `films.json` in the working directory.

So this one lives at project level. Skills are the modern shape of "a slash command with friends" — a directory with `SKILL.md` plus any supporting files, fired from the same `/name` interface a plain slash command does. They're where new Claude Code functionality lands first, so reaching for them by default is the right habit.

`~/dev/pick-film/.claude/skills/add-film/SKILL.md`:

```markdown
---
name: add-film
description: Add a film to films.json in the current directory
allowed-tools: Read, Edit
argument-hint: "<title>" <year> <mood> <runtime>
disable-model-invocation: true
---

The arguments are: $ARGUMENTS

Parse them as: a quoted title (multi-word), then a year (4-digit
integer), then a mood (single lowercase word), then a runtime in
minutes (integer).

Read `./films.json`. Append a new object `{ "title", "year", "mood",
"runtime" }` to the end of the array, preserving the order and
formatting of existing entries. Don't reformat the rest of the
file — only add the new entry on its own line just before the
closing `]`.

If `films.json` does not exist in the current directory, stop and
say so. Don't create it.
```

Two safety belts in the frontmatter. `allowed-tools` means `/add-film` can only `Read` and `Edit` — no Bash, no push, no `rm`. `disable-model-invocation: true` means the skill only fires when the human types `/add-film` — Claude can't decide on its own that now's a good moment to add a film. The second one is the line between "tool available when asked" and "tool the agent might pick up because the conversation drifted that way". Both matter; set them both from day one.

## After the Credits — A JSON-Validating Hook

The third piece is a hook. Hooks are shell scripts that fire at lifecycle events. `CLAUDE.md` *suggests* rules; hooks *enforce* them. Different layers, different jobs.

This one's a `PostToolUse` hook on `Edit` and `Write`. After every file write, it checks: did Claude just edit a `.json` file? If so, does it still parse? If not, exit code 2 with a stderr message means Claude reads the failure as feedback and can correct course on its own.

`~/.claude/hooks/validate-json.sh`:

```bash
#!/bin/bash
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // ""')

case "$file" in
  *.json)
    if ! jq empty "$file" >/dev/null 2>&1; then
      echo "Invalid JSON after edit to $file. The file no longer parses." >&2
      exit 2
    fi
    ;;
esac

exit 0
```

```bash
chmod +x ~/.claude/hooks/validate-json.sh
```

Hooks have the same user-vs-project split skills do. A `hooks` block in `~/.claude/settings.json` (user level) fires in *every* Claude Code session on this machine. The same block in `.claude/settings.json` (project level) only fires inside that project directory. The criterion is the same as for skills: is the rule general, or kit-specific?

JSON validation is general. Any project with a `.json` file benefits from the agent catching its own breakage on every write. So this one goes at user level — wire it once, and it covers `films.json` here, `package.json` next door, the JSON config in next month's project. The `case "$file"` switch in the script already makes it a no-op for non-JSON files, so there's no cost when working in a directory that has none. Contrast that with `/add-film` from the previous section, which would do nothing useful outside `~/dev/pick-film/` — that's why the skill is project-scoped and the hook isn't. Each piece picked the home that matches its specificity.

Now wire it into `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "$HOME/.claude/hooks/validate-json.sh" }
        ]
      }
    ]
  }
}
```

Hook fires silently on every edit. For non-JSON files: exit 0, nothing happens. For valid JSON: exit 0, nothing happens. For broken JSON: exit 2, Claude sees the message, has a chance to fix.

And it's cheap. Each fire is one shell process plus one `jq` invocation to read the input from stdin — roughly 10ms. For `.json` files there's a second `jq` to validate, so ~20ms there. Because the hook is `PostToolUse` (runs *after* the tool call) and not `PreToolUse` (runs *before*), even that hides behind the agent's next thinking step — it's not in the latency critical path the way a `PreToolUse` guard would be. A session with a hundred edits adds about a second of hook overhead total. You won't notice. The lesson from the series here is the lifecycle event you choose matters: `PreToolUse` for cheap-and-fast guards, `PostToolUse` for observation and validation, never `PreToolUse` for anything that takes more than a few milliseconds.

The hook above is the simplest version of an idea, not the finished one. The pattern generalises — dispatch on file extension and add handlers as you hit real cases: `.yaml` → `yq`, `.toml` → `python -m tomllib`, `.sh` → `shellcheck`, `.py` → `ruff check`. Each handler is one `case` branch in the same script. Growing it later is cheap — `PostToolUse` keeps the cost off the critical path. What I'd resist is pre-building five handlers on day one; a hook with one branch is debuggable in ten seconds, and the right time to add the next branch is when something actually trips you up. Slow semantic checks (`tsc --noEmit`, full ESLint with type-check) belong at *project* level in `.claude/settings.json` rather than user level, so they only fire where they earn their keep — that's the natural split as the kit matures into a real per-edit lint.

## Lights Up — Running the Kit

Three pieces, all wired. Let's prove they compose.

```bash
cd ~/dev/pick-film
claude
```

```text
> /add-film "Pride" 2014 wales 119
```

What happens, in order:

1. `/add-film` fires. Claude reads `CLAUDE.md` automatically (every session in this directory does), so the rules are already in context — the agent knows where the data lives, what fields it has, where new entries go.
2. The skill's prompt runs, parsing `"Pride" 2014 wales 119` into title/year/mood/runtime.
3. Claude `Read`s `films.json` and `Edit`s in the new entry just before the closing `]`.
4. The `PostToolUse` hook fires on the `Edit`. Sees a `.json` file, runs `jq empty films.json`, gets a clean exit. Silently allows.
5. Control returns. The kit's catalogue has one more film.

```bash
./pick-film.sh wales
```

```text
Hedd Wyn (1992) — 123min
```

The script does CLI things. The skill did the workflow. The hook ran the guardrail. Three Claude Code features, one human keystroke, one tool with more in it than when you started.

## Where I Cocked It Up

I'll be honest, first time I wired the JSON hook I forgot to `chmod +x` it. `PostToolUse` fires, the command runs, the script doesn't execute, and Claude Code carries on as if the hook hadn't been there — no loud error in the session. Took me ten minutes of staring at the matcher pattern, second-guessing my regex, before I tried `ls -l` and saw the missing executable bit staring back. Old Unix problem, new context. If your hook isn't firing, `ls -l ~/.claude/hooks/` is the first thing to check. Before you start debugging the matcher.

## The Final Cut

Everything you need, in one place. Drop these in, fire `/add-film`, watch the three features earn their keep.

```bash
# 1. ~/dev/pick-film/CLAUDE.md            (project context — the rules)
# 2. ~/dev/pick-film/films.json           (the catalogue)
# 3. ~/dev/pick-film/pick-film.sh         (the picker — chmod +x it)
# 4. ~/dev/pick-film/.claude/skills/add-film/SKILL.md   (the skill — project-scoped)
# 5. ~/.claude/hooks/validate-json.sh     (the JSON-validating hook — chmod +x it)
# Plus the hooks block in ~/.claude/settings.json
```

All five blocks are in this post above. Twenty lines of bash, one JSON file, three markdown files, one settings entry. Twenty minutes from `curl install` to working kit.

## Would I Actually Use Claude Code?

Yes — specifically for the bit the chat window can't do.

For a one-line code question (*"how do I write a Python list comprehension"*), the browser chat window is still faster. Open, ask, paste back. No install, no permissions dance, no terminal.

For *anything inside a real codebase*, Claude Code wins on the only thing that matters: it can see what I see. The agent can `Read`, `Grep`, `Bash`, edit files, run my tests, read the diff. The chat window can't do any of that without copy-paste, and the copy-paste tax adds up fast. By the third paste I've lost the thread.

For *custom workflows* — the kit pattern (`CLAUDE.md` + skill + hook) — Claude Code is in a class of its own. The film picker is a daft demo, but exactly the same shape works for things I do every week: release notes (a `/release-notes` skill, a `CLAUDE.md` that defines the changelog format, a hook that validates the file after edit), code reviews (a `/review` skill, a `CLAUDE.md` of standards, a hook that runs a linter), deploy gates (a `/deploy-check` skill, a `CLAUDE.md` with the prod conventions, a hook that refuses anything not on the safe-list). Each kit is a few markdown files and ten lines of shell. The interface change — going from "type a long prompt" to "type one slash invocation" — is the real product.

The worldview fit is strong. Claude Code is *source-controllable* (every kit is a few text files), *portable* (one curl install), *small* (a single binary, no dependency tree), and *local* (your config lives in your home directory and goes with you). Small, cheap, yours — the hungovercoders worldview without a sales pitch. Currently the only AI tool I've found that earns its keep on a real codebase without asking me to live on someone else's platform.

## Watch This Space, Fellow Hungovercoder

The 11-lesson deep-dive lives at **[hungovercoders.com/training/claude-code](https://hungovercoders.com/training/claude-code)** — permissions, `CLAUDE.md`, plan mode, slash commands, skills, hooks, subagents, MCP, and a capstone that strings the lot together into a real workflow. Forkable at **[github.com/hungovercoders/learn.claude-code](https://github.com/hungovercoders/learn.claude-code)** if you'd rather clone it and work through the examples locally with Claude Code itself sat next to the docs.

What I'd do differently next time: I'd `git init` inside `~/dev/pick-film/` from day one so the project-scoped skill and the `CLAUDE.md` travel with the rest of the kit. And I'd keep a small dotfiles-style repo for the user-level bits — the JSON-validating hook in `~/.claude/hooks/` deserves source control too. Source-control everything that has behaviour, *including* the bits of behaviour you bolt onto your AI assistant. Watch this space for more kits between meals. Cheers, fellow hungovercoder.
