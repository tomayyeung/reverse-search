#!/usr/bin/env sh
set -eu

BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"

case "$BASE" in
  ""|0000000000000000000000000000000000000000)
    exit 1
    ;;
esac

if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  exit 1
fi

git diff --quiet "$BASE" HEAD -- \
  frontend \
  reweave/src/common \
  wordlist/wordlist.txt \
  Cargo.toml \
  Cargo.lock \
  reweave/Cargo.toml \
  frontend/Cargo.toml \
  package.json \
  frontend/package.json \
  frontend/pnpm-lock.yaml \
  vercel.json \
  scripts
