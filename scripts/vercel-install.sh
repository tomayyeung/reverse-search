#!/usr/bin/env sh
set -eu

WASM_PACK_VERSION=0.13.1
WASM_PACK_DIR="wasm-pack-v${WASM_PACK_VERSION}-x86_64-unknown-linux-musl"
WASM_PACK_BIN="$HOME/.cargo/bin/wasm-pack"

rustup target add wasm32-unknown-unknown
mkdir -p "$HOME/.cargo/bin"

if [ ! -x "$WASM_PACK_BIN" ]; then
  curl -L "https://github.com/rustwasm/wasm-pack/releases/download/v${WASM_PACK_VERSION}/${WASM_PACK_DIR}.tar.gz" | tar xz
  mv "${WASM_PACK_DIR}/wasm-pack" "$WASM_PACK_BIN"
fi

corepack enable
pnpm --dir frontend install --frozen-lockfile
