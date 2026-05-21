#!/usr/bin/env python3
"""Migrate Jekyll posts to Astro. No external dependencies."""
import re
from pathlib import Path
from datetime import date as date_type

POSTS_DIR = Path("/Users/richardgriffiths/dev/hungovercoders/datagriff/docs/_posts")
OUTPUT_DIR = Path("/Users/richardgriffiths/dev/hungovercoders/site/src/content/blog")


def parse_frontmatter(fm_text: str) -> dict:
    """Parse simple YAML frontmatter into a dict. Handles multi-line values naively."""
    result = {}
    lines = fm_text.strip().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.startswith("#"):
            i += 1
            continue
        m = re.match(r'^(\w+):\s*(.*)', line)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        # Skip nested keys (indented next lines mean multi-line block — e.g. image: path:)
        if not val and i + 1 < len(lines) and lines[i + 1].startswith("  "):
            # Skip the entire block
            i += 1
            while i < len(lines) and lines[i].startswith("  "):
                i += 1
            continue
        result[key] = val
        i += 1
    return result


def build_frontmatter(fm: dict) -> str:
    title = fm.get("title", "").strip('"').strip("'")
    raw_date = fm.get("date", "")
    author = fm.get("author", "dataGriff").strip()
    description = fm.get("description", "").strip('"').strip("'")
    tags_raw = fm.get("tags", "")
    tags = tags_raw.split() if tags_raw else []

    lines = [
        "---",
        f"title: {json_str(title)}",
        f"date: {raw_date}",
        f"author: {author}",
        f"description: {json_str(description)}",
    ]
    if tags:
        lines.append("tags:")
        for t in tags:
            lines.append(f"- {t}")
    else:
        lines.append("tags: []")
    lines.append("---")
    return "\n".join(lines) + "\n"


def json_str(s: str) -> str:
    """Quote a string for YAML if it contains special chars."""
    if any(c in s for c in (':', '#', '"', "'", '{', '}')):
        escaped = s.replace('"', '\\"')
        return f'"{escaped}"'
    return s


def transform_content(content: str) -> str:
    content = content.replace("{{ site.baseurl }}/assets/", "/assets/")
    # Match {: target="_blank"} and {: target="\_blank"} (Jekyll escapes the underscore)
    content = re.sub(r'\{:target=["\']\\?_blank["\']\}', "", content)

    def rewrite_link(m):
        y, mo, d, slug = m.group(1), m.group(2), m.group(3), m.group(4)
        return f"/blog/{y}-{mo}-{d}-{slug}"

    # Match both full URLs (https://blog.hungovercoders.com/datagriff/...) and path-only
    content = re.sub(
        r'(?:https://blog\.hungovercoders\.com)?/datagriff/(\d{4})/(\d{2})/(\d{2})/([\w-]+)\.html',
        rewrite_link,
        content,
    )
    return content


for post_dir in sorted(POSTS_DIR.iterdir()):
    if not post_dir.is_dir():
        continue
    md_files = list(post_dir.glob("*.md"))
    if not md_files:
        continue
    src = md_files[0]
    text = src.read_text(encoding="utf-8")

    parts = text.split("---", 2)
    if len(parts) < 3:
        print(f"  ✗ skipped (no frontmatter): {src.name}")
        continue

    fm = parse_frontmatter(parts[1])
    body = parts[2]

    new_fm_text = build_frontmatter(fm)
    new_body = transform_content(body)

    out_path = OUTPUT_DIR / f"{post_dir.name}.md"
    out_path.write_text(new_fm_text + new_body, encoding="utf-8")
    print(f"  ✓ {out_path.name}")

print(f"\nDone. Output: {OUTPUT_DIR}")
