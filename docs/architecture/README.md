# Architecture

The site is an [Astro 6](https://astro.build/) static site built with the
[`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
adapter and deployed to Cloudflare Workers via Workers Builds.

## Surface

| Path | What it serves |
| ---- | -------------- |
| `/` | Homepage hero, "Latest from the blog", projects portfolio teaser |
| `/blog/` | Magazine-style blog index — every post from `src/content/blog/` |
| `/blog/<YYYY-MM-DD-slug>/` | Individual blog post page |
| `/training/` | Index of tutorial series sourced from sibling `learn.*` repos |
| `/training/<series>/<lesson>/` | Individual lesson page (rendered from the linked repo's `docs/`) |
| `/projects/` | Live and retired projects, sourced from `src/content/projects/` |
| `/about/` | Static about page |

## Source layout

```text
src/
├── components/         # Reusable Astro components (BaseHead, Header, Footer, etc.)
├── content/            # Content collections — typed via src/content.config.ts
│   ├── blog/           # *.md, glob: YYYY-MM-DD-<slug>.md
│   ├── projects/       # *.md
│   └── _drafts/        # Excluded from the build (never published)
├── layouts/            # Page layouts (BaseLayout, BlogPost, etc.)
├── pages/              # File-based routing (Astro convention)
├── styles/             # Site-wide CSS
└── content.config.ts   # Astro content collection schemas

public/                 # Static assets served verbatim
└── assets/<slug>/      # Per-post share images + inline screenshots
                        #   link.png — the 1200×630 social card
                        #   step-NN-*.png — optional walkthrough screenshots
```

## Training-repos wiring

Sibling tutorial repos (`learn.*`) are not committed here. They live next to the site in
`~/dev/hungovercoders/learn.<series>`. Two scripts pull them into the build:

- `scripts/fetch-training-repos.sh` runs in CI — clones every linked `learn.*` repo into
  `training-repos/<series>/` before `astro build`.
- `scripts/link-local-repos.sh` is the local equivalent — symlinks the sibling repos so a
  local `npm run build` picks them up without cloning.

Both scripts respect an `EXCLUDE` list so you can hide a series from the live build during
content review.

## Conventions

- **YAML / Astro files use tab indentation.** Markdown frontmatter is YAML and follows the same rule.
- **CSS is scoped per-component** with `<style>` blocks; mobile breakpoint is 720px.
- **Blog post slugs** follow `YYYY-MM-DD-<slug>.md` (enforced by the Astro content collection glob).
- **British English** in all prose.
