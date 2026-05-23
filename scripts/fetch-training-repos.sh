#!/usr/bin/env bash
set -euo pipefail

mkdir -p training-repos
cd training-repos

REPOS=(
  "learn.bento"
  # "learn.<next>"
)

for repo in "${REPOS[@]}"; do
  if [ ! -d "$repo" ]; then
    git clone --depth 1 "https://github.com/hungovercoders/$repo.git" "$repo"
  fi
done
