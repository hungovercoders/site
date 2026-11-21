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

## Privacy

Nothing published carries personal or account details. This covers post text, code blocks, alt text, screenshots, GIFs, video and share images.

- **Never publish:** email addresses, AWS account IDs and anything that contains one (ARNs, ECR URLs, bucket names), access keys and tokens, IP addresses, phone numbers, or home paths that show a username.
- **Use stand-ins:** `me@example.com` for an email, `123456789012` for an AWS account ID, `my-profile` for a named profile.
- **Check every image before it goes under `public/`.** Terminal prompts, browser address bars and cloud consoles are the usual leaks. Crop or mask the image, or retake it with the detail hidden.
- **Search the post and its code before publishing:** `grep -rnE '[0-9]{12}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|AKIA[0-9A-Z]{16}' <files>`, then read each hit.

The `dataGriff` handle and the `hungovercoders` organisation are public and fine to use.
