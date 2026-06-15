# Content

How to author the three content types this site publishes.

## Blog posts

Live in `src/content/blog/`. File naming: `YYYY-MM-DD-slug.md` (the regex pattern is in `src/content.config.ts`).

Required frontmatter:

```yaml
---
title: "Post Title in Sentence Case With Selective Capitals"
date: 2026-06-08
author: dataGriff
description: "Short one-line description — no trailing period"
tags: [tag-one, tag-two, hungovercoders]
image:
  path: /assets/2026-06-08-slug/link.png
---
```

The `image.path` should point at a 1200×630 PNG share image. Generate it with:

```bash
node scripts/generate-share-image.mjs 2026-06-08-slug "Post Title" "by dataGriff"
```

The output lands at `public/assets/<slug>/link.png` — under `public/` so Astro copies it into `dist/client/`. Anything written to `dist/` outside `dist/client/` is not deployed (see [deployment/](../deployment/README.md)).

## Training lessons

Live canonically in sibling `learn.*` repos under `content/`. Required frontmatter on each lesson markdown:

```yaml
---
title: "Lesson title"
series: "series-slug"
order: 3
description: "Short description"
canonical_url: "https://www.hungovercoders.com/training/series-slug/lesson-slug/"
---
```

`order` must match the leading number on the directory (e.g. `03-foo/` → `order: 3`) and must be unique within the series.

The site reads lessons from `training-repos/` at build time. See [architecture/](../architecture/README.md) for the wiring.

## Projects

Live in `src/content/projects/` as one markdown file per project:

```yaml
---
title: Project Name
description: "One-line description"
url: https://project.example.com
status: live
started: 2026-01-15
tags: [tag, tag]
order: 2
---
```

Body is optional — the projects page renders the frontmatter as a card.

## Voice and conventions

- British English.
- No trailing period on `description`.
- Tab indentation for YAML / Astro files.
- Per-component scoped CSS in `<style>` blocks; breakpoint is 720px.
