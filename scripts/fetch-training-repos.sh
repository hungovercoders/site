#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="training-repos"

# Temporarily excluded pending content review:
#   learn.bento
#   learn.claude-code
REPOS=(
)

mkdir -p "$TARGET_DIR"

if [ ${#REPOS[@]} -eq 0 ]; then
  echo "No training repos configured — nothing to fetch"
  exit 0
fi

for repo in "${REPOS[@]}"; do
  if [ -L "$TARGET_DIR/$repo" ]; then
    # Local dev: link-local-repos.sh symlinks the sibling source repo here.
    # Never reset a symlinked working copy — it lives outside training-repos/
    # and may have uncommitted edits the developer is actively working on.
    echo "Symlinked $repo (local dev) — skipping fetch"
  elif [ -d "$TARGET_DIR/$repo" ]; then
    echo "Updating $repo..."
    cd "$TARGET_DIR/$repo"
    git fetch --depth 1 origin main
    git reset --hard origin/main
    cd - > /dev/null
  else
    echo "Cloning $repo..."
    git clone --depth 1 "https://github.com/hungovercoders/$repo.git" "$TARGET_DIR/$repo"
  fi
done

echo "✓ All training repos fetched"
