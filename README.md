# Clock - Time Tracking Application

A comprehensive time tracking application for managing working hours, home office days, sick days, and more.

## Overview

The Clock app is a web-based time tracking system with a planned iOS extension. Users can create custom tracking buttons, start timers with a single click, pause them with a second click, and automatically log their activities to a centralized backend.

**Key Features:**
- User authentication and management
- Customizable activity tracking buttons with add/edit controls
- Visual timer interface with button enlargement and pause functionality
- Daily time tracking display on each button
- Bottom navigation with Timer, History, and Settings tabs
- History view with yearly statistics, calendar view, and manual entry
- Settings for country-specific working days and public holidays
- Account management (password, name, email changes)
- Automatic logging to backend
- Docker-based deployment for both frontend and backend
- iOS app with widgets and Live Activities for lock screen timer control

---

## Development Tasks

### 1. Project Setup & Infrastructure

#### 1.1 Repository & Version Control
- [ ] Set up Git repository structure
- [ ] Create `.gitignore` files for frontend, backend, and mobile
- [ ] Define branching strategy (main, develop, feature branches)
- [ ] Set up CI/CD pipeline configuration

#### 1.2 Docker Configuration
- [ ] Create `docker-compose.yml` for local development
- [ ] Create Dockerfile for backend service
- [ ] Create Dockerfile for frontend service
- [ ] Configure environment variables management
- [ ] Set up Docker networking between services
- [ ] Create production docker-compose configuration
- [ ] Document Docker deployment process

#### 1.3 VPS Deployment Setup
- [ ] Configure VPS server requirements
- [ ] Set up SSL/TLS certificates (Let's Encrypt)
- [ ] Configure reverse proxy (nginx/traefik)
- [ ] Set up domain and DNS configuration
- [ ] Implement backup strategy
- [ ] Configure monitoring and logging

---

### 2. Backend Development

#### 2.1 Backend Framework & Architecture
- [ ] Choose backend framework (Node.js/Express, Python/FastAPI, Go, etc.)
- [ ] Set up project structure and dependencies
- [ ] Configure database (PostgreSQL/MySQL/MongoDB)
- [ ] Set up ORM/ODM (Prisma, TypeORM, SQLAlchemy, etc.)
- [ ] Implement RESTful API structure
- [ ] Set up API documentation (Swagger/OpenAPI)

#### 2.2 Database Schema Design
- [ ] Design Users table (id, email, password_hash, name, country, created_at, updated_at)
- [ ] Design Buttons table (id, user_id, name, color, position, icon, created_at)
- [ ] Design TimeLogs table (id, user_id, button_id, start_time, end_time, duration, notes, is_manual)
- [ ] Design Holidays table (id, country, date, name, year)
- [ ] Create database migrations
- [ ] Set up database seeding for development

#### 2.3 User Management & Authentication
- [ ] Implement user registration endpoint
- [ ] Implement user login endpoint (JWT/session-based)
- [ ] Implement password hashing (bcrypt/argon2)
- [ ] Implement token refresh mechanism
- [ ] Implement logout functionality
- [ ] Add password reset functionality
- [ ] Implement email verification (optional)
- [ ] Add rate limiting for authentication endpoints

#### 2.4 Button Management API
- [ ] Create endpoint: GET /api/buttons (list user's buttons)
- [ ] Create endpoint: POST /api/buttons (create new button)
- [ ] Create endpoint: PUT /api/buttons/:id (update button)
- [ ] Create endpoint: DELETE /api/buttons/:id (delete button)
- [ ] Implement button validation logic
- [ ] Add authorization checks (users can only manage their buttons)

#### 2.5 Timer & Logging API
- [ ] Create endpoint: POST /api/timelogs/start (start timer)
- [ ] Create endpoint: POST /api/timelogs/stop (stop timer)
- [ ] Create endpoint: GET /api/timelogs (list time logs with filters)
- [ ] Create endpoint: GET /api/timelogs/today/:button_id (get total time for button today)
- [ ] Create endpoint: GET /api/timelogs/stats (statistics and reports)
- [ ] Create endpoint: GET /api/timelogs/stats/yearly (yearly statistics per button)
- [ ] Create endpoint: PUT /api/timelogs/:id (edit time log)
- [ ] Create endpoint: DELETE /api/timelogs/:id (delete time log)
- [ ] Create endpoint: POST /api/timelogs/manual (manually add past time logs)
- [ ] Implement automatic timer stop on new timer start
- [ ] Add validation for overlapping time logs

#### 2.6 Public Holidays API Integration
- [ ] Create endpoint: GET /api/holidays/:country/:year (fetch holidays)
- [ ] Implement caching for holiday data
- [ ] Create service to crawl https://www.arbeitstage.org/feiertage/
- [ ] Store holiday data in database
- [ ] Set up quarterly scheduled job to crawl and update all holidays
- [ ] Create endpoint: GET /api/workingdays/summary (calculate working days)
- [ ] Implement logic to exclude public holidays from working days calculation

#### 2.7 Backend Testing & Quality
- [ ] Set up testing framework (Jest, pytest, etc.)
- [ ] Write unit tests for authentication
- [ ] Write unit tests for button management
- [ ] Write unit tests for timer logging
- [ ] Write integration tests for API endpoints
- [ ] Set up code linting and formatting
- [ ] Implement error handling and logging
- [ ] Add API response validation

---

### 3. Frontend Development (Web)

#### 3.1 Frontend Framework Setup
- [ ] Choose frontend framework (React, Vue, Angular, Svelte)
- [ ] Initialize project with build tools (Vite, Next.js, etc.)
- [ ] Set up routing library
- [ ] Configure state management (Redux, Zustand, Pinia, etc.)
- [ ] Set up CSS framework/solution (Tailwind, Material-UI, etc.)
- [ ] Configure TypeScript (if applicable)

#### 3.2 Authentication UI
- [ ] Create login page (landing page)
- [ ] Create registration page
- [ ] Create forgot password page
- [ ] Implement authentication state management
- [ ] Add form validation
- [ ] Implement protected route guards
- [ ] Add "Remember Me" functionality
- [ ] Create logout functionality

#### 3.3 Main Dashboard & Button Grid
- [ ] Design responsive grid layout
- [ ] Create Button component with customizable styling
- [ ] Add "Add item" button on top of button grid
- [ ] Add "Edit items" button on top of button grid to enter edit mode
- [ ] Implement button configuration modal/form
- [ ] Add drag-and-drop for button reordering
- [ ] Implement button create/edit/delete functionality
- [ ] Add color picker for button customization
- [ ] Add icon selector for buttons
- [ ] Implement grid responsive behavior (mobile, tablet, desktop)

#### 3.4 Timer Functionality
- [ ] Implement button click to start timer
- [ ] Create timer animation (button enlargement effect)
- [ ] Display running timer with elapsed time
- [ ] Add visual indicator for active timer
- [ ] Implement timer pause functionality (second click on enlarged button)
- [ ] Log stop time to backend when timer is paused
- [ ] Shrink button back to normal size after pause
- [ ] Display total time spent on that button for the current day
- [ ] Display timer state persistence across page reloads
- [ ] Handle multiple timer scenarios (stop previous when starting new)

#### 3.5 Bottom Navigation Bar
- [ ] Create bottom navigation bar component
- [ ] Add "Timer" tab (button grid view)
- [ ] Add "History" tab
- [ ] Add "Settings" tab
- [ ] Implement active tab highlighting
- [ ] Add navigation between tabs

#### 3.6 History View
- [ ] Create history page accessible from bottom navigation
- [ ] Display overall statistics per button (summary of time spent on each task)
- [ ] Add year selector for filtering statistics
- [ ] Implement calendar view showing all activities
- [ ] Add visual indicators for activities on calendar days
- [ ] Create "Add manual entry" button for past items
- [ ] Implement manual time log entry form with date/time picker
- [ ] Display detailed daily breakdown when clicking calendar days

#### 3.7 Settings View
- [ ] Create settings page accessible from bottom navigation
- [ ] Add country selector dropdown
- [ ] Integrate with https://www.arbeitstage.org/feiertage/ API
- [ ] Fetch and display public holidays for selected country
- [ ] Calculate and display working days summary (exclude holidays)
- [ ] Add account management section
- [ ] Implement change password form
- [ ] Implement change name form
- [ ] Implement change email form
- [ ] Add account deletion option with confirmation

#### 3.8 Time Log Management (Admin)
- [ ] Implement filtering by date range in history view
- [ ] Implement filtering by button/activity type
- [ ] Implement time log editing
- [ ] Add time log deletion with confirmation
- [ ] Create export functionality (CSV/PDF)

#### 3.9 Statistics & Reports
- [ ] Implement daily/weekly/monthly views
- [ ] Add charts and visualizations (chart.js, recharts, etc.)
- [ ] Show total hours per activity type
- [ ] Add comparison views (week over week, etc.)
- [ ] Display year-over-year statistics

#### 3.10 Frontend Testing & Quality
- [ ] Set up testing library (Vitest, Jest, Cypress)
- [ ] Write unit tests for components
- [ ] Write integration tests for user flows
- [ ] Add E2E tests for critical paths
- [ ] Set up linting and formatting (ESLint, Prettier)
- [ ] Implement accessibility standards (WCAG)
- [ ] Add loading states and error handling
- [ ] Optimize performance (lazy loading, code splitting)

---

### 4. API Integration & Communication

#### 4.1 API Client Setup
- [ ] Set up HTTP client (Axios, Fetch wrapper)
- [ ] Implement request/response interceptors
- [ ] Add authentication token handling
- [ ] Implement error handling and retry logic
- [ ] Add request/response logging for debugging
- [ ] Create typed API client (if using TypeScript)

#### 4.2 Real-time Features (Optional)
- [ ] Evaluate need for WebSocket/SSE
- [ ] Implement real-time timer updates
- [ ] Add real-time notifications
- [ ] Implement optimistic UI updates

---

### 5. iOS App Development (Future Extension)

#### 5.1 iOS Project Setup
- [ ] Create new Swift/SwiftUI project
- [ ] Set up Xcode workspace
- [ ] Configure app bundle identifier
- [ ] Set up dependency management (SPM, CocoaPods)
- [ ] Configure app signing and provisioning

#### 5.2 iOS Authentication
- [ ] Implement login screen in SwiftUI
- [ ] Implement registration screen
- [ ] Add Keychain storage for tokens
- [ ] Implement biometric authentication (Face ID/Touch ID)
- [ ] Add authentication state management

#### 5.3 iOS Main Features
- [ ] Create button grid view in SwiftUI
- [ ] Implement button configuration
- [ ] Add timer functionality with animations
- [ ] Implement background timer support
- [ ] Add push notifications for timer reminders
- [ ] Create time logs view
- [ ] Implement statistics view

#### 5.4 iOS Widgets
- [ ] Create widget extension target in Xcode
- [ ] Design widget layout to display timer buttons
- [ ] Implement widget configuration (select which buttons to show)
- [ ] Add tap handlers to start timers from widget
- [ ] Implement widget refresh mechanism
- [ ] Support multiple widget sizes (small, medium, large)
- [ ] Update widget when timer state changes

#### 5.5 iOS Live Activities
- [ ] Create Live Activity target in Xcode
- [ ] Design Live Activity UI for lock screen
- [ ] Display running timer information (button name, elapsed time)
- [ ] Add pause button to Live Activity
- [ ] Implement pause functionality from lock screen
- [ ] Update Live Activity in real-time with timer progress
- [ ] Handle Live Activity lifecycle (start, update, end)
- [ ] Add Dynamic Island support for iPhone 14 Pro and later

#### 5.6 iOS-Specific Features
- [ ] Implement Apple Watch companion app
- [ ] Add Siri shortcuts integration
- [ ] Implement app icon customization

#### 5.7 iOS Testing & Deployment
- [ ] Write unit tests
- [ ] Write UI tests
- [ ] Test on multiple device sizes
- [ ] Set up TestFlight distribution
- [ ] Prepare App Store assets
- [ ] Submit to App Store

---

### 6. Security & Compliance

#### 6.1 Security Measures
- [ ] Implement HTTPS everywhere
- [ ] Add CORS configuration
- [ ] Implement rate limiting
- [ ] Add input sanitization
- [ ] Implement SQL injection prevention
- [ ] Add XSS protection
- [ ] Implement CSRF protection
- [ ] Set up security headers
- [ ] Regular dependency updates
- [ ] Security audit and penetration testing

#### 6.2 Data Privacy
- [ ] Create privacy policy
- [ ] Implement GDPR compliance (if applicable)
- [ ] Add data export functionality
- [ ] Add data deletion functionality
- [ ] Implement data encryption at rest
- [ ] Set up audit logging

---

### 7. Documentation

#### 7.1 Technical Documentation
- [ ] Write API documentation
- [ ] Create architecture diagrams
- [ ] Document database schema
- [ ] Write deployment guide
- [ ] Create development setup guide
- [ ] Document environment variables
- [ ] Add troubleshooting guide

#### 7.2 User Documentation
- [ ] Create user guide
- [ ] Add in-app help tooltips
- [ ] Create video tutorials (optional)
- [ ] Write FAQ section
- [ ] Add onboarding flow

---

### 8. DevOps & Monitoring

#### 8.1 Monitoring & Logging
- [ ] Set up application logging
- [ ] Implement error tracking (Sentry, Rollbar)
- [ ] Add performance monitoring (APM)
- [ ] Set up uptime monitoring
- [ ] Create alerting rules
- [ ] Implement log aggregation

#### 8.2 Backup & Recovery
- [ ] Set up automated database backups
- [ ] Test backup restoration process
- [ ] Document disaster recovery plan
- [ ] Implement point-in-time recovery

#### 8.3 Performance & Scaling
- [ ] Implement database indexing
- [ ] Add caching layer (Redis)
- [ ] Optimize API queries
- [ ] Set up CDN for static assets
- [ ] Plan for horizontal scaling
- [ ] Load testing

---

### 9. Release & Maintenance

#### 9.1 Pre-Launch
- [ ] Final security audit
- [ ] Performance testing
- [ ] User acceptance testing
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing
- [ ] Prepare marketing materials

#### 9.2 Launch
- [ ] Deploy to production
- [ ] Configure production monitoring
- [ ] Set up backup procedures
- [ ] Create rollback plan
- [ ] Announce launch

#### 9.3 Post-Launch
- [ ] Monitor for issues
- [ ] Collect user feedback
- [ ] Plan feature roadmap
- [ ] Regular maintenance updates
- [ ] Performance optimization
- [ ] Feature enhancements

---

## Technology Stack Recommendations

### Backend
- **Runtime**: Node.js or Python
- **Framework**: Express.js/Fastify or FastAPI/Django
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **ORM**: Prisma or SQLAlchemy

### Frontend (Web)
- **Framework**: React or Vue.js
- **Build Tool**: Vite
- **State Management**: Zustand or Pinia
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Charts**: Chart.js or Recharts

### iOS
- **Language**: Swift
- **UI Framework**: SwiftUI
- **Networking**: URLSession or Alamofire
- **Data Persistence**: Core Data or Realm

### DevOps
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx
- **SSL**: Let's Encrypt (Certbot)
- **Monitoring**: Prometheus + Grafana or simpler alternatives
- **Logging**: Winston or Pino (Node.js) or built-in logging

---

## Getting Started

This is a planning document. To begin development:

1. Start with **Project Setup & Infrastructure** (Section 1)
2. Develop the **Backend** first (Section 2) to have API ready
3. Build the **Web Frontend** (Section 3) and integrate with backend
4. Deploy using **Docker** to VPS
5. Plan **iOS App** development (Section 5) as a future enhancement

For each task, create separate feature branches and merge after testing and review.

---

## Contributing

When implementing features from this task list:
- Check off completed tasks
- Document any deviations from the plan
- Update this README with actual technology choices
- Add links to detailed documentation as it's created

---

## License

[To be determined]
