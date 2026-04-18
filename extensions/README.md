# LogFizz Browser Extensions

Browser extensions for **Chrome**, **Firefox**, and **Safari** that give you quick access to LogFizz directly from your browser toolbar.

## Features

- **Quick App Access** – Click the extension icon to open LogFizz in a new tab.
- **Timer Controls** – Start and stop your tracking timers without leaving the current page.
- **Login-Aware** – Shows your timers when logged in, or a login prompt when not.

## Project Structure

```
extensions/
├── shared/          # Shared source files (popup, styles, scripts, icons)
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── background.js
│   └── icons/       # Generated PNG icons (16, 32, 48, 128)
├── chrome/          # Chrome extension (Manifest V3)
│   └── manifest.json
├── firefox/         # Firefox extension (Manifest V2 / WebExtensions)
│   └── manifest.json
├── safari/          # Safari extension (Manifest V3 / WebExtensions)
│   └── manifest.json
├── build.sh         # Copies shared files into each browser folder
└── README.md
```

## Building

Run the build script to copy shared assets into each browser folder:

```bash
cd extensions
bash build.sh
```

After building, each browser folder (`chrome/`, `firefox/`, `safari/`) is a self-contained, loadable extension.

## Loading for Development

### Chrome
1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extensions/chrome/` folder

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `extensions/firefox/manifest.json`

### Safari
1. Open Xcode and create a new Safari Web Extension project
2. Replace the extension resources with the contents of `extensions/safari/`
3. Enable the extension in Safari → Preferences → Extensions

## Configuration

The extension connects to the LogFizz API at `https://app.logfizz.magnusso.nz` by default. The URL is stored in the extension's sync storage and can be customised.

## How It Works

1. The popup checks if the user is authenticated by calling `GET /api/auth/me`.
2. If authenticated, it fetches the user's timers via `GET /api/timers/sync`.
3. Timer start/stop actions use `POST /api/timelogs/sync` – the same endpoint the main app uses.
4. All requests use `credentials: 'include'` to share the session cookie with the LogFizz app.
