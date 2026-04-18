#!/usr/bin/env bash
# Build script for LogFizz browser extensions.
# Copies shared assets into each browser-specific folder so that each folder
# is a self-contained, loadable extension.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED="$SCRIPT_DIR/shared"

for BROWSER in chrome firefox safari; do
  TARGET="$SCRIPT_DIR/$BROWSER"
  echo "Building $BROWSER extension …"

  # Copy shared popup, CSS, JS, and background script
  cp "$SHARED/popup.html" "$TARGET/popup.html"
  cp "$SHARED/popup.css"  "$TARGET/popup.css"
  cp "$SHARED/popup.js"   "$TARGET/popup.js"
  cp "$SHARED/background.js" "$TARGET/background.js"

  # Copy icons
  mkdir -p "$TARGET/icons"
  cp "$SHARED/icons/"*.png "$TARGET/icons/"

  echo "  → $TARGET ready"
done

echo "Done. Each browser folder is now a loadable extension."
