#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="training-repos"

REPOS=(
  "learn.bento"
  "learn.claude-code"
)

mkdir -p "$TARGET_DIR"

for repo in "${REPOS[@]}"; do
  if [ -d "$TARGET_DIR/$repo" ]; then
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
