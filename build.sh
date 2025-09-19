#!/bin/bash
# Build script for Wallabag Saver extension
# Outputs: dist/chrome/ and dist/firefox/

set -e

SRC_DIR="$(dirname "$0")"
DIST_DIR="$SRC_DIR/dist"

# Clean dist
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/chrome" "$DIST_DIR/firefox"

# Chrome build: use manifest.json
cp "$SRC_DIR"/manifest.json "$DIST_DIR/chrome/manifest.json"
cp "$SRC_DIR"/*.js "$DIST_DIR/chrome/"
cp "$SRC_DIR"/permissions_chrome.json "$DIST_DIR/chrome/permissions.json"
cp "$SRC_DIR"/*.html "$DIST_DIR/chrome/"
rm "$DIST_DIR/chrome/privacy_policy_firefox.html"
mv "$DIST_DIR/chrome/privacy_policy_chrome.html" "$DIST_DIR/chrome/privacy_policy.html"
cp "$SRC_DIR"/*.css "$DIST_DIR/chrome/"
cp "$SRC_DIR"/icon*.png "$DIST_DIR/chrome/"

# Firefox build: use manifest_firefox.json
cp "$SRC_DIR"/manifest_firefox.json "$DIST_DIR/firefox/manifest.json"
cp "$SRC_DIR"/*.js "$DIST_DIR/firefox/"
cp "$SRC_DIR"/permissions_firefox.json "$DIST_DIR/firefox/permissions.json"
cp "$SRC_DIR"/*.html "$DIST_DIR/firefox/"
rm "$DIST_DIR/firefox/privacy_policy_chrome.html"
mv "$DIST_DIR/firefox/privacy_policy_firefox.html" "$DIST_DIR/firefox/privacy_policy.html"
cp "$SRC_DIR"/*.css "$DIST_DIR/firefox/"
cp "$SRC_DIR"/icon*.png "$DIST_DIR/firefox/"

# Zip builds
cd "$DIST_DIR/chrome" && zip -r ../wallabag_saver_chrome.zip .
cd "../.."
cd "$DIST_DIR/firefox" && zip -r ../wallabag_saver_firefox.zip .

echo "Build complete. Chrome and Firefox zips are in $DIST_DIR."
