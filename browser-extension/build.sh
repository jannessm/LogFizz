#!/bin/bash
# Build script for TapShift browser extensions

set -e

echo "🔨 Building TapShift Browser Extensions"
echo ""

# Create dist directory
mkdir -p dist

# Package Chrome extension
echo "📦 Packaging Chrome extension..."
cd chrome
zip -r ../dist/tapshift-chrome.zip * -x "*.DS_Store"
cd ..
echo "✅ Chrome: dist/tapshift-chrome.zip"

# Package Firefox extension
echo "📦 Packaging Firefox extension..."
cd firefox
zip -r ../dist/tapshift-firefox.zip * -x "*.DS_Store"
cd ..
echo "✅ Firefox: dist/tapshift-firefox.zip"

# Safari instructions
echo ""
echo "📱 Safari extension:"
echo "   Safari extensions require Xcode on macOS."
echo "   See safari/README.md for build instructions."
echo ""

echo "✨ Build complete!"
echo ""
echo "Installation:"
echo "  Chrome:  Load unpacked from browser-extension/chrome/"
echo "  Firefox: Load temporary add-on from browser-extension/firefox/manifest.json"
echo "  Safari:  See browser-extension/safari/README.md"
