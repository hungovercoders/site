# Content

What this repo produces: blog posts, training lessons, and project entries. Each has its own
shape; all share the same `image.path` convention for share images.

## Blog posts

One markdown file per post under `src/content/blog/`, slugged `YYYY-MM-DD-<title-slug>.md`.

Required frontmatter:

```yaml
---
title: "Post title in title case"
date: 2026-06-14
author: dataGriff
description: "One sentence summary, no trailing period"
tags:
- topic
- hungovercoders
image:
  path: /assets/2026-06-14-post-slug/link.png
---
```

The `image.path` field drives `og:image` / `twitter:image` for social-card rendering. The
file at that path must be a 1200×630 PNG — generate it with `scripts/generate-share-image.mjs`:

```bash
node scripts/generate-share-image.mjs <slug> "<title>" "<tagline>"
```

The script writes `public/assets/<slug>/link.png` with the hungovercoders branding.

Inline images (step-by-step screenshots, diagrams, demo shots) live in the same per-post
asset directory — see the [hc-screenshot skill](https://github.com/hungovercoders/library)
for the convention (`public/assets/<slug>/<name>.png`, site-absolute embed paths).

## Training lessons

Tutorial lessons live in sibling `learn.<series>` repos — not in this repo. The site clones
them at build time via `scripts/fetch-training-repos.sh` (CI) or symlinks them via
`scripts/link-local-repos.sh` (local).

Per-lesson frontmatter requirements:

```yaml
---
title: "Lesson title"
series: <series-slug>
order: 1
description: "What this lesson teaches, no trailing period"
canonical_url: https://hungovercoders.com/training/<series>/<lesson-slug>/
---
```

`order` must match the directory's leading number (e.g. `02-foo/` → `order: 2`); duplicates
within a series fail the `ss:hygiene:docs-structure` check on the linked repo.

## Projects

Live and retired projects under `src/content/projects/`. Each file is a short markdown card
rendered in `/projects/`. Frontmatter shape:

```yaml
---
name: Project name
status: live | retired | building
href: https://project.example.com
description: "One sentence summary"
---
```

## Drafts

`src/content/blog/_drafts/` is excluded from the build via the content collection glob. Use
it for in-flight posts that aren't ready to publish; the `ss:hygiene:docs-accuracy` build
verifies nothing under `_drafts/` leaks into `dist/client/`.
