# Clock Frontend - Offline-First Time Tracking Web App

A progressive web application built with Svelte and TypeScript that provides an offline-first time tracking experience.

## ToDo

* [X] fix calendar/history
* [ ] add dayly time goal instead of button wise time goal
* [ ] export as csv, xlsx
* [ ] add sick days/kindkrank/arbeitstage at timelog overview
* [ ] add single stop entry
* [ ] chart database (one db for each month) to limit computing (getAll)

## Features

### 🔒 Authentication

- User registration and login
- Session-based authentication
- Secure password management
- Profile customization

### ⏱️ Timer Management

- Create customizable tracking buttons
- Start/stop timers with one click
- Visual timer feedback with enlarged buttons
- Real-time elapsed time display
- Track multiple activities

### 🎯 Goal Tracking

- Set daily time goals per button
- Configure goal days (weekdays, weekends, etc.)
- Visual progress indicators
- Automatic break time calculation
- German labor law compliance (6h: 30min, 9h: 45min breaks)

### 📊 Statistics & History

- Yearly statistics per activity
- Recent entries view
- Time breakdowns
- Total hours and minutes tracking

### 🔄 Offline-First Architecture

- **IndexedDB** for local data persistence
- **Sync Queue** for offline changes
- **Automatic sync** when connection is restored
- **Local-first** approach - works completely offline
- **Background sync** every 5 minutes when online
- Visual offline/online indicators

### ⚙️ Settings

- Profile management
- Password change
- Manual sync trigger
- Sync status monitoring

## Technology Stack

- **Framework**: Svelte 5
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Routing**: svelte-routing
- **HTTP Client**: Ky
- **Date Handling**: Day.js
- **Offline Storage**: IndexedDB (via idb)
- **State Management**: Svelte stores

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env to configure API endpoint
# VITE_API_URL=http://localhost:3000
```

### Development

```bash
# Start development server
npm run dev

# Server will start on http://localhost:5173
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment

```bash
# Build Docker image
docker build -t clock-frontend .

# Run container
docker run -p 8080:80 clock-frontend
```

Or use docker-compose from project root:

```bash
# Start all services (frontend, backend, database)
docker-compose up -d
```

Frontend will be available at: http://localhost:8080

## Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── BottomNav.svelte
│   │   ├── ButtonForm.svelte
│   │   ├── ButtonGrid.svelte
│   │   └── TimerButton.svelte
│   ├── routes/           # Page components
│   │   ├── Dashboard.svelte
│   │   ├── History.svelte
│   │   ├── Login.svelte
│   │   └── Settings.svelte
│   ├── stores/           # Svelte stores for state
│   │   ├── auth.ts
│   │   ├── buttons.ts
│   │   └── timelogs.ts
│   ├── services/         # Business logic
│   │   ├── api.ts        # HTTP API client
│   │   └── sync.ts       # Offline sync service
│   ├── lib/
│   │   └── db/           # IndexedDB wrapper
│   │       └── index.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── App.svelte        # Root component
│   ├── main.ts           # Entry point
│   └── app.css           # Global styles
├── Dockerfile            # Production Docker image
├── nginx.conf            # Nginx configuration
└── package.json
```

## Offline-First Architecture

### How it Works

1. **Local Storage**: All data is stored in IndexedDB immediately when created/modified
2. **Sync Queue**: Changes are added to a sync queue when offline
3. **Auto Sync**: When connection is restored, queued changes are synced to the server
4. **Conflict Resolution**: Server data takes precedence, with local changes merged

### Data Flow

```
User Action → Store → IndexedDB (immediate) → Sync Queue → Backend API
                                                    ↓
                                              (when online)
```

### IndexedDB Schema

- **buttons**: User's tracking buttons
- **timelogs**: Time log entries
- **syncQueue**: Pending sync operations
- **user**: Current user data
- **settings**: App settings

## API Integration

The frontend communicates with the backend API at `http://localhost:3000` (configurable via `VITE_API_URL`).

### API Endpoints Used

- Authentication: `/api/auth/*`
- Buttons: `/api/buttons/*`
- Time Logs: `/api/timelogs/*`
- Holidays: `/api/holidays/*`

All API calls automatically include credentials (cookies) for session authentication.

## Environment Variables

Create a `.env` file:

```bash
VITE_API_URL=http://localhost:3000
```

## Development Tips

- Use browser DevTools → Application → IndexedDB to inspect local data
- Check Network tab to see API calls and offline behavior
- Toggle offline mode in DevTools to test offline functionality
- Check Console for sync events and errors

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 12.2+)
- Opera: Full support

IndexedDB is supported in all modern browsers.

## License

[To be determined]
