# TapShift Browser Extensions

Browser extensions for TapShift that allow you to start and stop timers directly from your browser, and quickly navigate to the TapShift webapp.

## Features

- ✅ Start and stop timers for any button
- ✅ View active timer with live duration
- ✅ Quick access to all configured timer buttons
- ✅ Open TapShift webapp in new tab or focus existing tab
- ✅ Configurable TapShift server URL
- ✅ Session-based authentication (uses existing webapp login)
- ✅ Works with Chrome, Firefox, and Safari

## Installation

### Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `browser-extension/chrome` directory
5. The TapShift Timer extension should now appear in your toolbar

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to `browser-extension/firefox` and select `manifest.json`
4. The extension will be loaded temporarily (until Firefox restarts)

**For permanent installation:**
1. Package the extension: `cd browser-extension/firefox && zip -r ../tapshift-firefox.zip *`
2. Sign the extension at https://addons.mozilla.org/developers/
3. Install the signed `.xpi` file

### Safari (macOS)

Safari extensions require Xcode. See [safari/README.md](safari/README.md) for detailed instructions.

**Quick Start:**
```bash
cd browser-extension
xcrun safari-web-extension-converter safari-resources/manifest.json \
  --app-name "TapShift Timer" \
  --bundle-identifier com.tapshift.timer \
  --project-location safari
```

Then open the generated Xcode project and build.

## Configuration

### Setting the TapShift URL

1. Click the TapShift extension icon in your browser
2. Click the ⚙️ settings icon
3. Enter your TapShift server URL (e.g., `http://localhost:3000` or `https://tapshift.example.com`)
4. Click Save

### Authentication

The extension uses session-based authentication. You must:

1. First log in to the TapShift webapp in your browser
2. The extension will use the same session cookies
3. If you see "Please log in", click "Open TapShift" to log in

## Usage

### Starting a Timer

1. Click the TapShift extension icon
2. Click on any button to start a timer
3. The active timer will be displayed with a live duration

### Stopping a Timer

1. Click the TapShift extension icon
2. Click the "Stop Timer" button in the active timer section

### Opening the Webapp

1. Click the TapShift extension icon
2. Click "Open Webapp" or "Open TapShift"
3. If a tab with TapShift is already open, it will be focused
4. Otherwise, a new tab will be opened

## Development

### Project Structure

```
browser-extension/
├── shared/              # Shared code for all browsers
│   ├── api.js          # TapShift API client
│   ├── popup.html      # Extension popup UI
│   ├── popup.css       # Popup styling
│   └── popup.js        # Popup logic
├── chrome/             # Chrome extension
│   ├── manifest.json   # Chrome manifest (v3)
│   ├── background.js   # Service worker
│   └── icons/          # Extension icons
├── firefox/            # Firefox extension
│   ├── manifest.json   # Firefox manifest (v2)
│   ├── background.js   # Background script
│   └── icons/          # Extension icons
├── safari/             # Safari extension
│   ├── safari-resources/ # Extension files
│   └── README.md       # Safari-specific instructions
└── icons/              # Source icons
    └── icon.svg        # SVG source icon
```

### Building

Each browser extension is self-contained in its respective directory:

- **Chrome**: `browser-extension/chrome/` - ready to load unpacked
- **Firefox**: `browser-extension/firefox/` - ready to load as temporary add-on
- **Safari**: Requires Xcode build process (see safari/README.md)

### Testing

1. Install the extension in your browser (see Installation above)
2. Ensure TapShift backend is running
3. Log in to the TapShift webapp
4. Click the extension icon and test the features

### Icons

The extension uses icons in multiple sizes:
- 16x16 - Toolbar icon
- 32x32 - Retina toolbar icon
- 48x48 - Extension management page
- 128x128 - Web store / App Store

To generate icons from the source SVG:

```bash
# Using ImageMagick (if installed)
cd browser-extension/icons
convert -background none -resize 16x16 icon.svg icon16.png
convert -background none -resize 32x32 icon.svg icon32.png
convert -background none -resize 48x48 icon.svg icon48.png
convert -background none -resize 128x128 icon.svg icon128.png
```

Or use online tools like https://cloudconvert.com/svg-to-png

## API Integration

The extension communicates with the TapShift backend API:

- `GET /api/auth/me` - Check authentication status
- `GET /api/buttons` - Get list of timer buttons
- `POST /api/timelogs/start` - Start a timer
- `POST /api/timelogs/stop/:id` - Stop a timer
- `GET /api/timelogs` - Get time logs (to check for active timers)

Authentication is handled via session cookies (same as webapp).

## Permissions

### Chrome
- `storage` - Store extension settings (API URL)
- `tabs` - Open/focus webapp tabs
- `host_permissions` - Make API requests to TapShift server

### Firefox
- `storage` - Store extension settings
- `tabs` - Open/focus webapp tabs

### Safari
- Same as Firefox (WebExtensions API)

## Troubleshooting

### "Not authenticated" error

1. Make sure you're logged in to the TapShift webapp
2. Check that the TapShift URL in settings matches your server
3. Try refreshing the extension popup
4. If using HTTPS, ensure CORS is configured on the backend

### Extension doesn't load

**Chrome:**
- Check `chrome://extensions/` for errors
- Ensure manifest.json is valid
- Try reloading the extension

**Firefox:**
- Check `about:debugging` for errors
- Ensure manifest.json is valid
- Try reloading the extension

**Safari:**
- See [safari/README.md](safari/README.md) for Safari-specific troubleshooting

### Buttons don't appear

1. Check that you have buttons configured in the TapShift webapp
2. Click the "Refresh" button in the extension
3. Check browser console for API errors

### CORS errors

If you see CORS errors in the browser console:

1. Ensure the backend has CORS enabled
2. Check that the FRONTEND_URL environment variable includes your extension's origin
3. For Chrome, you may need to add the extension ID to CORS allowed origins

## Publishing

### Chrome Web Store

1. Create a developer account at https://chrome.google.com/webstore/developer/dashboard
2. Pay one-time $5 registration fee
3. Create a ZIP file of the chrome directory
4. Upload and publish

### Firefox Add-ons

1. Create an account at https://addons.mozilla.org/developers/
2. Create a ZIP file of the firefox directory
3. Submit for review
4. Once approved, it will be published

### Safari / Mac App Store

1. Enroll in Apple Developer Program ($99/year)
2. Build the extension in Xcode
3. Archive and submit through App Store Connect
4. See [safari/README.md](safari/README.md) for details

## Contributing

When contributing to the browser extensions:

1. Test in all three browsers (Chrome, Firefox, Safari)
2. Maintain compatibility with the shared codebase
3. Update documentation as needed
4. Follow the existing code style

## License

[To be determined - should match main repository license]
