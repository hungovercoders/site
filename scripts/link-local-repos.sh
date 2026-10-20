#!/usr/bin/env bash
set -euo pipefail

# Creates symlinks in training-repos/ for every learn.* repo found in the
# parent directory. Run once after cloning the site repo for local dev.

TARGET_DIR="training-repos"
PARENT_DIR=".."

# Temporarily excluded from the site pending content review.
EXCLUDE=(
  "learn.claude-code"
)

mkdir -p "$TARGET_DIR"

linked=0
skipped=0

for repo_path in "$PARENT_DIR"/learn.*/; do
  [ -d "$repo_path" ] || continue
  repo=$(basename "$repo_path")
  abs_path=$(cd "$repo_path" && pwd)

  excluded=0
  for e in "${EXCLUDE[@]}"; do
    if [ "$repo" = "$e" ]; then excluded=1; break; fi
  done
  if [ $excluded -eq 1 ]; then
    echo "Excluded: $repo (see EXCLUDE list)"
    skipped=$((skipped + 1))
    continue
  fi

  if [ -L "$TARGET_DIR/$repo" ]; then
    echo "Already linked: $repo"
    skipped=$((skipped + 1))
  elif [ -d "$TARGET_DIR/$repo" ]; then
    echo "Skipping $repo — directory exists and is not a symlink (run fetch-training-repos.sh to refresh)"
    skipped=$((skipped + 1))
  else
    ln -s "$abs_path" "$TARGET_DIR/$repo"
    echo "Linked: $repo → $abs_path"
    linked=$((linked + 1))
  fi
done

if [ $linked -eq 0 ] && [ $skipped -eq 0 ]; then
  echo "No learn.* repos found in $PARENT_DIR — clone them first"
  exit 1
fi

echo "✓ Done ($linked linked, $skipped already in place)"
