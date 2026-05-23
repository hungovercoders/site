# site — agent context

## What this repo is

The public-facing site at `hungovercoders.com`. Built with Astro. Serves blog posts from `src/content/blog/` and training lessons sourced from sibling `learn.*` repos.

## Repo layout

```
src/content.config.ts   content collections: blog + training
src/pages/              routes — blog/[...slug].astro, training/[series]/[lesson].astro
src/layouts/            BlogPost.astro, TrainingLesson.astro
src/components/         BaseHead, Header, Footer, Search
scripts/
  fetch-training-repos.sh   CI: shallow-clones learn.* repos into training-repos/
  link-local-repos.sh       local dev: symlinks sibling learn.* repos into training-repos/
training-repos/             gitignored — populated by one of the two scripts above
```

## Training content — how it works

Lesson markdown lives canonically in the `learn.*` tutorial repos (e.g. `learn.bento/content/*.md`). The Astro glob loader reads from `training-repos/` at build time. The `training-repos/` directory is never committed.

- **CI / Cloudflare Pages**: `npm run build` runs `fetch-training-repos.sh` first, which shallow-clones each repo listed in the script.
- **Local dev**: run `./scripts/link-local-repos.sh` once after cloning. It auto-discovers every `learn.*` sibling directory and symlinks it into `training-repos/`. Edit lesson markdown locally and changes appear immediately in `npm run dev`.

## Local dev setup (first time)

```bash
git clone https://github.com/hungovercoders/site.git
cd site
npm install
./scripts/link-local-repos.sh   # requires learn.* repos to be cloned as siblings
npm run dev
```

## Adding a new training series

1. Create the `learn.<topic>` repo following the `content/` + `examples/` layout (see that repo's `AGENTS.md`)
2. Add `"learn.<topic>"` to the `REPOS` array in `scripts/fetch-training-repos.sh`
3. `link-local-repos.sh` picks it up automatically for local dev (no change needed)

## Conventions

- Blog posts live in `src/content/blog/` with pattern `YYYY-MM-DD-slug.md`
- Training lessons require frontmatter: `title`, `series`, `order`, `description`, `canonical_url`
- YAML / Astro files use tab indentation
- CSS is scoped per-component with `<style>` blocks; breakpoint is 720px
