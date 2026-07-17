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

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

if [ -d reweave/api ]; then
  git diff --quiet "$BASE" HEAD -- \
    reweave/api \
    reweave/src \
    reweave/Cargo.toml \
    reweave/vercel.json \
    reweave/scripts \
    Cargo.lock \
    schema.sql
else
  git diff --quiet "$BASE" HEAD -- \
    api \
    src \
    Cargo.toml \
    vercel.json \
    scripts \
    Cargo.lock \
    schema.sql
fi
