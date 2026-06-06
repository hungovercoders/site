---
title: "Building a Film Picker with Claude Code"
date: 2026-05-25
author: dataGriff
description: "A short tour of Claude Code's moving parts plus a twenty-minute three-file kit that picks a film by mood — built from a CLAUDE.md, a custom skill, and a JSON-validating hook"
tags: [claude-code, ai, hungovercoders]
image:
  path: /assets/2026-05-25-building-a-film-picker-with-claude-code/link.png
---

I've been meaning to write up Claude Code properly for a while now. Using it all the time for parallel threads of work, a writing library and a handful of skills built off the back of it, a 13-lesson tutorial shipped to go with — and yet no single post that says *"here's what's in the box and here's one small thing you can build today"*. So that's this post. The tour of what Claude Code ships first, then a twenty-minute kit that picks a film for the evening — partly because the kit shape generalises to anything you do more than twice a week, and partly because film-pickers, like release notes and standups, are exactly the daft-but-useful repeat job a slash command earns its keep on. The thing I want to land is the *composition*: Claude Code is the kit, not any one feature, and most posts demo a single feature in isolation and call it a tutorial.

## Pre-Requisites

- macOS, Linux, or Windows (with WSL)
- A Claude.ai Pro account (Claude Code isn't on the free tier)
- A terminal you actually like — iTerm2, Warp, Ghostty
- `jq` installed (`brew install jq` on macOS, `apt install jq` on Debian/Ubuntu)
- About twenty minutes

## What's On the Programme

The full series at [hungovercoders.com/training/claude-code](https://hungovercoders.com/training/claude-code) has thirteen lessons. Here's what Claude Code actually ships, one sentence each:

- **Permissions and safety** — the bouncer at the door. Five permission modes, four config layers, deny rules that win over allow rules.
- **CLAUDE.md** — the recipe card the agent reads at the start of every session. Project context, conventions, things to never do.
- **Plan mode** — read-only thinking gear that writes a plan before touching a single file. Stops the agent vibing at your codebase.
- **Slash commands and skills** — markdown-based prompt templates fired by `/name`. Slash commands are single files; skills are directories with `SKILL.md` plus optional supporting files. Both supported; skills are the modern shape and where new functionality lands.
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

Three minutes, cold machine to authenticated session.

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

So this one lives at project level. Skills are the modern shape — a directory with `SKILL.md` plus any supporting files, fired from the same `/name` interface as a plain slash command. New functionality lands on skills first, so default to them.

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

Hook fires silently. Non-JSON files and valid JSON exit 0; broken JSON exits 2 and Claude reads the stderr message as feedback, with a chance to fix on the next attempt.

And it's cheap. One shell process plus one `jq` to read stdin — roughly 10ms per edit, ~20ms for `.json` files where a second `jq` validates. Because it's `PostToolUse` (runs *after* the tool call), even that hides behind the agent's next thinking step rather than gating the next action. A hundred-edit session adds about a second of hook overhead total. The lesson: `PreToolUse` for cheap-and-fast guards, `PostToolUse` for observation and validation, never expensive work in `PreToolUse`.

This hook is the simplest version of an idea. The pattern generalises — add handlers to the `case` statement as you hit real cases: `.yaml` → `yq`, `.toml` → `python -m tomllib`, `.sh` → `shellcheck`, `.py` → `ruff check`. `PostToolUse` keeps the cost off the critical path, so growing it later is cheap. Don't pre-build five handlers on day one though — a one-branch hook is debuggable in ten seconds, and the right time to add the next branch is when something trips you up. Slow semantic checks (`tsc`, full ESLint) belong at *project* level in `.claude/settings.json` so they only fire where they earn their keep.

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

The honest version of how I got here: I got into an auto-edit-accept-changes loop without thinking and kept pressing yes without planning or reading correctly. Ended up doing a force push and rewriting history on a repo, lost all public lineage. Luckily it wasn't an important repo, but it made me realise how easy it is to give the brain over — and that getting guardrails in with an *intent to use auto mode as a discipline* is a better goal than lazily pressing 2 over and over. That's why the kit above wires `disable-model-invocation: true` on `/add-film` and pushes the schema check into a `PostToolUse` hook. The three pieces of this kit are exactly the kind of guardrails that, if you put them in first, let you race for auto-mode proficiency safely instead of finding out where the floor is the way I did.

One smaller gotcha worth flagging while you're wiring hooks: if a hook script isn't executable, `PostToolUse` fires, the command runs, the script doesn't execute, and Claude Code carries on as if the hook hadn't been there — no loud error in the session. `ls -l ~/.claude/hooks/` is the first thing to check when a hook isn't firing. Before you start debugging the matcher.

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

## How I Actually Use Claude Code

I was happy using Copilot in an agentic chat window and felt I was doing OK there. The honest reason I tried Claude Code was the industry trumpets and increased usage around me — wanted to see what the fuss was about and ensure I was skilled in something becoming increasingly common. The love came later: it's now awesome and I love using it, including straight from the terminal — multi-threaded terminal tools like cmux and zed have really opened my eyes. Still very much learning best practice on `CLAUDE.md` (the lesson series is part of that learning), and haven't leveraged permissions as well as I should yet — at home I run plan mode then auto-edit because I'm more cavalier; at work I run plan mode then manually accept edits.

For a one-line code question (*"how do I write a Python list comprehension"*), the browser chat window is still faster. Open, ask, paste back. No install, no permissions dance, no terminal.

For *anything inside a real codebase*, Claude Code wins on the only thing that matters: it can see what I see. The agent can `Read`, `Grep`, `Bash`, edit files, run my tests, read the diff. The chat window can't do any of that without copy-paste, and the copy-paste tax adds up fast. By the third paste I've lost the thread.

For *custom workflows* — the kit pattern (`CLAUDE.md` + skill + hook) — this is the bit I'm most enthusiastic about. The first proper skill I built was for **ODCS data contract creation**: when I first tried to make data contracts Claude kept giving me JSON schemas, which isn't what ODCS is. The skill bundled the prompt with the standard's reference material and locked the output shape. From there a writing library — the **hungovercoders content library** that wrote a chunk of this very tutorial series in voice — earned the full "library, not just a skill" shape because it's a *multi-focus media suite*. Everything else has stayed as skills (started as commands; conversation taught me skills were the better investment). The interface change — from "type a long prompt" to "type one slash invocation" — is the real product, and the workflow becomes conversational: interactive and refine as a pair, while the skill keeps me consistent.

The worldview fit is strong. Claude Code is *source-controllable* (every kit is a few text files), *portable* (one curl install), *small* (a single binary, no dependency tree), and *local* (your config lives in your home directory and goes with you). Small, cheap, yours — the hungovercoders worldview without a sales pitch. So far the only AI tool I've found that earns its keep on a real codebase without asking me to live on someone else's platform.

## Watch This Space, Fellow Hungovercoder

The 13-lesson deep-dive lives at **[hungovercoders.com/training/claude-code](https://hungovercoders.com/training/claude-code)** — permissions, `CLAUDE.md`, plan mode, slash commands, skills, hooks, subagents, MCP, and a capstone that strings the lot together into a real workflow. Forkable at **[github.com/hungovercoders/learn.claude-code](https://github.com/hungovercoders/learn.claude-code)** if you'd rather clone it and work through the examples locally with Claude Code itself sat next to the docs.

This post is the appetiser; the series is the main course. Same films, same `films.json` — the tutorial picks up exactly where this post leaves off and builds the kit out into a Cinema Companion across thirteen lessons. By lesson thirteen you've got two slash commands, three skills, a schema-checking hook, an MCP server querying the catalogue in SQL, and an install script that makes the whole thing portable from any directory. If this post left you wanting one or two of those, that's the series.

What I'd do differently next time: the bigger lesson, honestly — I don't think you can do anything other than just use it to see what breaks; but if I'd had the discipline at the start I'd have set up the guardrails and *raced for auto-mode proficiency* as quickly as possible. That's where maximum throughput lives: embed the policies, then let rip with development knowing the guardrails are there. The smaller lesson — `git init` inside `~/dev/pick-film/` from day one, and a `datagriff/dotfiles` repo for the user-level bits, source-controlled and symlinked into `~/.claude/`. Source-control everything that has behaviour, *including* the bits you bolt onto your AI assistant. Watch this space for more kits between meals. Cheers, fellow hungovercoder.
