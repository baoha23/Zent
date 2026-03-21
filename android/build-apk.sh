#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
SRC_DIR="$ANDROID_DIR/src"
MANIFEST="$ANDROID_DIR/AndroidManifest.xml"
ASSETS_DIR="$ANDROID_DIR/assets"
BUILD_DIR="$ANDROID_DIR/build"

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
BUILD_TOOLS_DIR="D:/All/Android/sdk/build-tools/34.0.0"
ANDROID_JAR="D:/All/Android/sdk/platforms/android-34/android.jar"

AAPT="$BUILD_TOOLS_DIR/aapt.exe"
D8="$BUILD_TOOLS_DIR/d8.bat"
ZIPALIGN="$BUILD_TOOLS_DIR/zipalign.exe"
APKSIGNER="$BUILD_TOOLS_DIR/apksigner.bat"

if [[ ! -f "$ANDROID_JAR" ]]; then
  echo "Missing android.jar at: $ANDROID_JAR"
  exit 1
fi

for tool in "$AAPT" "$D8" "$ZIPALIGN" "$APKSIGNER"; do
  if [[ ! -f "$tool" ]]; then
    echo "Missing build tool: $tool"
    exit 1
  fi
done

bash "$ANDROID_DIR/sync-web-assets.sh"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$BUILD_DIR/out"

echo "Compiling Java sources..."
javac \
  -source 8 \
  -target 8 \
  -classpath "$ANDROID_JAR" \
  -d "$BUILD_DIR/classes" \
  $(find "$SRC_DIR" -name "*.java")

echo "Packaging classes.jar..."
jar --create --file "$BUILD_DIR/classes.jar" -C "$BUILD_DIR/classes" .

echo "Converting classes -> dex..."
"$D8" \
  --lib "$ANDROID_JAR" \
  --output "$BUILD_DIR/dex" \
  "$BUILD_DIR/classes.jar"

UNSIGNED_APK="$BUILD_DIR/out/expense-tracker-unsigned.apk"
ALIGNED_APK="$BUILD_DIR/out/expense-tracker-aligned.apk"
SIGNED_APK="$BUILD_DIR/out/expense-tracker-debug.apk"

echo "Packaging resources and assets..."
"$AAPT" package -f -M "$MANIFEST" -S "$ANDROID_DIR/res" -I "$ANDROID_JAR" -A "$ASSETS_DIR" -F "$UNSIGNED_APK"

echo "Adding classes.dex..."
(cd "$BUILD_DIR/dex" && zip -q -u "$UNSIGNED_APK" classes.dex)

echo "Zipalign..."
"$ZIPALIGN" -f 4 "$UNSIGNED_APK" "$ALIGNED_APK"

DEBUG_KEYSTORE="$ANDROID_DIR/.keystore/debug.keystore"
if [[ ! -f "$DEBUG_KEYSTORE" ]]; then
  mkdir -p "$ANDROID_DIR/.keystore"
  keytool -genkeypair \
    -v \
    -keystore "$DEBUG_KEYSTORE" \
    -storepass android \
    -alias androiddebugkey \
    -keypass android \
    -dname "CN=Android Debug,O=Android,C=US" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000
fi

echo "Signing APK..."
"$APKSIGNER" sign \
  --ks "$DEBUG_KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$SIGNED_APK" \
  "$ALIGNED_APK"

"$APKSIGNER" verify "$SIGNED_APK"

echo "APK built: $SIGNED_APK"
