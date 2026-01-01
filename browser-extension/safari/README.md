# Safari Extension for TapShift

## Overview

Safari extensions for macOS and iOS require Xcode and an Apple Developer account. Unlike Chrome and Firefox extensions that can be sideloaded, Safari extensions must be built through Xcode.

## Requirements

- macOS with Xcode 13 or later
- Apple Developer account (free or paid)
- Safari 14 or later

## Creating the Safari Extension

### Option 1: Using Xcode Command Line Tools

1. Create a Safari Web Extension from the Chrome/Firefox extension:

\`\`\`bash
# Navigate to the browser-extension directory
cd browser-extension

# Create Safari extension using xcrun
xcrun safari-web-extension-converter chrome --project-location safari --app-name "TapShift Timer"
\`\`\`

This will create an Xcode project in the `safari` directory.

### Option 2: Manual Creation in Xcode

1. Open Xcode
2. File → New → Project
3. Select "Safari Extension App" template
4. Name it "TapShift Timer"
5. Copy the extension files from the chrome directory to the Safari extension's Resources folder

## Building the Extension

1. Open the generated Xcode project:
   \`\`\`bash
   open safari/TapShift\ Timer/TapShift\ Timer.xcodeproj
   \`\`\`

2. Select your development team in the project settings
3. Build and run the project (⌘R)
4. Enable the extension in Safari:
   - Safari → Preferences → Extensions
   - Enable "TapShift Timer"

## Key Differences from Chrome/Firefox

- Safari uses the same WebExtensions API as Chrome and Firefox
- manifest.json is compatible with minor adjustments
- Requires code signing
- Distributed through the App Store or ad-hoc

## Files Included

The `safari-resources` directory contains all the necessary files:
- manifest.json
- popup.html, popup.css, popup.js
- api.js
- background.js
- icons/

These are ready to be included in the Xcode project.

## Distribution

### For Development
- Build and run from Xcode
- Enable in Safari Preferences

### For Production
- Enroll in Apple Developer Program ($99/year)
- Archive and distribute through App Store Connect
- Or distribute through Mac App Store

## Troubleshooting

### Extension doesn't appear in Safari
1. Make sure you've enabled "Allow Unsigned Extensions" in Safari's Develop menu
2. Rebuild the project in Xcode
3. Restart Safari

### Permission issues
Safari may require additional permissions in the manifest.json. Check the console for specific errors.

## Converting Chrome Extension to Safari

If you haven't used the conversion tool yet:

\`\`\`bash
cd /path/to/TapShift/browser-extension
xcrun safari-web-extension-converter chrome \\
  --app-name "TapShift Timer" \\
  --bundle-identifier com.tapshift.timer \\
  --project-location safari
\`\`\`

This will:
1. Create an Xcode project
2. Convert the manifest.json
3. Copy all extension files
4. Set up the Swift wrapper code

## Next Steps

1. Run the conversion command (requires macOS with Xcode)
2. Open the project in Xcode
3. Configure signing
4. Build and test
5. Submit to App Store (for production)
