#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/android/assets/www"

mkdir -p "$ASSETS_DIR"

cp "$ROOT_DIR/index.html" "$ASSETS_DIR/index.html"
cp "$ROOT_DIR/styles.css" "$ASSETS_DIR/styles.css"
cp "$ROOT_DIR/app.js" "$ASSETS_DIR/app.js"

rm -rf "$ASSETS_DIR/assets"
if [ -d "$ROOT_DIR/assets" ]; then
  cp -R "$ROOT_DIR/assets" "$ASSETS_DIR/assets"
fi

echo "Synced web files to $ASSETS_DIR"
