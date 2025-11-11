# Clock Backend API

Backend API for the Clock time tracking application built with Fastify, TypeORM, and PostgreSQL.

## Features

- **User Authentication**: Session-based authentication with bcrypt password hashing
- **Button Management**: Create, read, update, delete custom tracking buttons
- **Timer Functionality**: Start/stop timers with automatic break calculation
- **Time Logging**: Manual and automatic time log entries
- **Goal Tracking**: Set and track daily time goals per button
- **Holiday Management**: Store and retrieve holiday data
- **API Documentation**: Auto-generated Swagger/OpenAPI documentation

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Fastify
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Authentication**: Session-based with @fastify/session
- **Validation**: TypeBox
- **Testing**: Vitest
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy the environment file:
```bash
cp .env.example .env
```

3. Configure your database in `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=clock_user
DB_PASSWORD=clock_password
DB_DATABASE=clock_db
SESSION_SECRET=your-secret-key
PORT=3000
```

4. Set up PostgreSQL database:
```bash
# Create database
psql -U postgres
CREATE DATABASE clock_db;
CREATE USER clock_user WITH ENCRYPTED PASSWORD 'clock_password';
GRANT ALL PRIVILEGES ON DATABASE clock_db TO clock_user;
```

5. (Optional) Seed the database with sample data:
```bash
npm run seed
```

This will create:
- 2 sample users (`demo@example.com` / `demo123` and `test@example.com` / `test123`)
- 5 pre-configured buttons with different goals
- Sample time logs for the past 7 days
- 1 active timer for testing
- German and US holidays

## Running the Application

### Development Mode
```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot reload enabled.

### Production Mode
```bash
npm run build
npm start
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3000/docs`
- API Health Check: `http://localhost:3000/health`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/change-password` - Change password
- `PUT /api/auth/profile` - Update user profile

### Buttons
- `GET /api/buttons` - Get all user buttons
- `POST /api/buttons` - Create a new button
- `GET /api/buttons/:id` - Get a specific button
- `PUT /api/buttons/:id` - Update a button
- `DELETE /api/buttons/:id` - Delete a button

### Time Logs
- `POST /api/timelogs/start` - Start a timer
- `POST /api/timelogs/stop/:id` - Stop a timer
- `GET /api/timelogs/active` - Get active timer
- `GET /api/timelogs` - Get time logs (with filters)
- `GET /api/timelogs/today/:button_id` - Get today's time for a button
- `GET /api/timelogs/stats/yearly` - Get yearly statistics
- `GET /api/timelogs/goal-progress/:button_id` - Get goal progress
- `POST /api/timelogs/manual` - Create manual time log
- `PUT /api/timelogs/:id` - Update time log
- `DELETE /api/timelogs/:id` - Delete time log

### Holidays
- `GET /api/holidays/:country/:year` - Get holidays (auto-fetches if missing/outdated)
- `GET /api/holidays/workingdays/summary` - Get working days summary
- `GET /api/holidays/countries` - Get list of available countries
- `GET /api/holidays/metadata` - Get crawler metadata
- `POST /api/holidays` - Add a holiday
- `POST /api/holidays/crawl` - Manually crawl holidays for country/year
- `POST /api/holidays/refresh` - Refresh outdated holiday data
- `DELETE /api/holidays/:id` - Delete a holiday

## Testing

### Local Testing

The test suite requires PostgreSQL to be running. Tests will automatically:
- Create a test database (`clock_test_db`) if it doesn't exist
- Clean and reinitialize the schema before each test suite
- Use environment variables for database configuration

Run tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

Run tests with coverage:
```bash
npm run test:coverage
```

### CI/CD Testing

The CI workflow automatically:
- Sets up a PostgreSQL 14 service container
- Configures database credentials via environment variables
- Waits for PostgreSQL to be ready before running tests
- Runs the full test suite with coverage reporting

The workflow is triggered on:
- Push to `main`, `develop`, or `copilot/**` branches (when backend files change)
- Pull requests to `main` or `develop` branches (when backend files change)

## Database Schema

### Users
- `id` (UUID, PK)
- `email` (String, unique)
- `password_hash` (String)
- `name` (String)
- `country` (String, optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Buttons
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `name` (String)
- `emoji` (String, optional)
- `color` (String, optional)
- `position` (Number)
- `icon` (String, optional)
- `goal_time_minutes` (Number, optional)
- `goal_days` (Array of numbers, optional)
- `auto_subtract_breaks` (Boolean)
- `created_at` (Timestamp)

### TimeLogs
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `button_id` (UUID, FK)
- `start_time` (Timestamp)
- `end_time` (Timestamp, optional)
- `duration` (Number, in minutes)
- `break_time_subtracted` (Number, in minutes)
- `notes` (String, optional)
- `is_manual` (Boolean)

### Holidays
- `id` (UUID, PK)
- `country` (String)
- `date` (Date)
- `name` (String)
- `year` (Number)

### HolidayMetadata
- `id` (UUID, PK)
- `country` (String)
- `year` (Number)
- `last_fetched_at` (Timestamp)
- `holiday_count` (Number)
- `source_url` (String, optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

## Break Time Calculation

Automatic break time is calculated based on German labor laws:
- **Less than 6 hours**: No break
- **6-9 hours**: 30 minutes break
- **9+ hours**: 45 minutes break

This can be enabled per button with the `auto_subtract_breaks` flag.

## Project Structure

```
backend/
├── src/
│   ├── __tests__/         # Test files
│   ├── config/            # Configuration files
│   │   └── database.ts    # Database configuration
│   ├── entities/          # TypeORM entities
│   │   ├── User.ts
│   │   ├── Button.ts
│   │   ├── TimeLog.ts
│   │   └── Holiday.ts
│   ├── routes/            # API routes
│   │   ├── auth.routes.ts
│   │   ├── button.routes.ts
│   │   ├── timelog.routes.ts
│   │   └── holiday.routes.ts
│   ├── services/          # Business logic
│   │   ├── auth.service.ts
│   │   ├── button.service.ts
│   │   ├── timelog.service.ts
│   │   └── holiday.service.ts
│   ├── types/             # TypeScript type definitions
│   │   └── session.ts
│   ├── utils/             # Utility functions
│   │   ├── password.ts
│   │   └── breaks.ts
│   ├── app.ts             # Fastify app setup
│   └── index.ts           # Entry point
├── .env.example           # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## License

[To be determined]
