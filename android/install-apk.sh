#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APK_PATH="$ROOT_DIR/android/build/out/expense-tracker-debug.apk"

if [[ ! -f "$APK_PATH" ]]; then
  echo "APK not found: $APK_PATH"
  echo "Run: bash android/build-apk.sh"
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found in PATH"
  exit 1
fi

adb devices
adb install -r "$APK_PATH"
echo "Installed: $APK_PATH"
