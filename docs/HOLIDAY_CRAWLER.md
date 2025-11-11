# Holiday Crawler Service

The Holiday Crawler Service automatically fetches public holiday data from external APIs and stores it in the database. It includes intelligent caching and automatic refresh mechanisms.

## Features

- ✅ Automatic fetching from [Nager.Date API](https://date.nager.at/)
- ✅ Intelligent caching (auto-refresh after 3 months)
- ✅ Support for 100+ countries
- ✅ CLI tool for manual management
- ✅ REST API endpoints for integration
- ✅ Periodic refresh routine
- ✅ Metadata tracking (last fetch date, source URL, etc.)

## API Source

The service uses the free **Nager.Date Public Holiday API**:
- **Base URL**: https://date.nager.at/api/v3
- **Documentation**: https://date.nager.at/Api
- **Countries**: 100+ countries supported
- **Rate Limit**: No strict limits, but we add delays between requests

## Database Schema

### HolidayMetadata Table
Tracks when holiday data was last fetched:

```typescript
{
  id: UUID
  country: string          // ISO 3166-1 alpha-2 code (e.g., "DE", "US")
  year: number            // Year (e.g., 2025)
  last_fetched_at: Date   // When data was last fetched
  holiday_count: number   // Number of holidays fetched
  source_url: string      // API URL used
  created_at: Date
  updated_at: Date
}
```

## CLI Usage

The holiday crawler includes a powerful CLI tool for managing holiday data.

### Installation

The scripts are already configured in `package.json`. No additional installation needed.

### Commands

#### List Available Countries
```bash
npm run holiday:crawl -- --list-countries
```
Shows all ~100 country codes supported by the API.

#### Initialize Common Countries
```bash
npm run holiday:init
```
Fetches holidays for common countries (DE, US, GB, FR, AT, CH) for previous, current, and next year.

#### Crawl Specific Country and Year
```bash
npm run holiday:crawl -- --country DE --year 2025
```

#### Crawl Multiple Years
```bash
npm run holiday:crawl -- --country US --years 2024,2025,2026
```

#### Force Refresh (Ignore Cache)
```bash
npm run holiday:crawl -- --country GB --year 2025 --force
```

#### Refresh Outdated Data
```bash
npm run holiday:refresh
```
Automatically finds and refreshes all holiday data older than 3 months.

#### View Metadata
```bash
npm run holiday:crawl -- --metadata
```
Shows all holiday data in the database with last fetch dates. Entries older than 90 days are marked with ⚠️.

#### Run All Maintenance Tasks
```bash
npm run maintenance
```
Runs holiday refresh + cleanup of old deleted records.

## REST API Endpoints

### GET /api/holidays/:country/:year
Fetch holidays for a specific country and year. **Auto-fetches** if data is missing or outdated.

**Example:**
```bash
curl http://localhost:3000/api/holidays/DE/2025
```

**Response:**
```json
[
  {
    "id": "uuid",
    "country": "DE",
    "date": "2025-01-01T00:00:00.000Z",
    "name": "Neujahr",
    "year": 2025
  },
  ...
]
```

### GET /api/holidays/countries
Get list of all available country codes.

**Example:**
```bash
curl http://localhost:3000/api/holidays/countries
```

**Response:**
```json
{
  "countries": ["AD", "AL", "AR", "AT", "AU", ...]
}
```

### POST /api/holidays/crawl
Manually trigger a crawl for specific country/year.

**Request:**
```json
{
  "country": "FR",
  "year": 2025,
  "force": false
}
```

**Response:**
```json
{
  "success": true,
  "holidayCount": 11,
  "message": "Successfully fetched 11 holidays for FR 2025"
}
```

### GET /api/holidays/metadata
Get metadata for all crawled holiday data.

**Response:**
```json
[
  {
    "id": "uuid",
    "country": "DE",
    "year": 2025,
    "last_fetched_at": "2025-11-11T10:00:00.000Z",
    "holiday_count": 9,
    "source_url": "https://date.nager.at/api/v3/PublicHolidays/2025/DE",
    "created_at": "2025-11-11T10:00:00.000Z",
    "updated_at": "2025-11-11T10:00:00.000Z"
  },
  ...
]
```

### POST /api/holidays/refresh
Trigger refresh of all outdated holiday data (>3 months old).

**Response:**
```json
{
  "refreshed": 5,
  "failed": 0,
  "details": [
    {
      "country": "DE",
      "year": 2024,
      "success": true,
      "message": "Successfully fetched 9 holidays"
    },
    ...
  ]
}
```

## Automatic Refresh Logic

### When Data is Refreshed

The service automatically refreshes holiday data when:

1. **Data doesn't exist** - First time fetching for a country/year
2. **Data is older than 3 months** - Stale data is automatically refreshed
3. **Explicit request** - Using `--force` flag or API call

### Refresh Strategy

```typescript
// Check if refresh needed
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

if (lastFetchedAt < threeMonthsAgo) {
  // Refresh data
}
```

### Smart Caching

When you call `GET /api/holidays/:country/:year`:
1. Service checks `HolidayMetadata` table
2. If data is fresh (< 3 months), returns from database
3. If data is stale or missing, fetches from API first
4. Updates metadata timestamp
5. Returns holiday data

## Scheduled Jobs (Recommended Setup)

For production, set up a cron job or scheduled task to periodically refresh holiday data.

### Option 1: Cron Job (Linux/macOS)

Edit crontab:
```bash
crontab -e
```

Add entry to run monthly:
```cron
# Run holiday refresh on 1st of every month at 2 AM
0 2 1 * * cd /path/to/clock/backend && npm run holiday:refresh >> /var/log/holiday-refresh.log 2>&1
```

### Option 2: Node.js Cron Package

Install:
```bash
npm install node-cron
```

Add to `src/index.ts`:
```typescript
import cron from 'node-cron';
import { CleanupService } from './services/cleanup.service.js';

// Run every Sunday at 3 AM
cron.schedule('0 3 * * 0', async () => {
  console.log('Running scheduled holiday refresh...');
  const cleanup = new CleanupService();
  await cleanup.refreshHolidays();
});
```

### Option 3: GitHub Actions (CI/CD)

Create `.github/workflows/holiday-refresh.yml`:
```yaml
name: Holiday Data Refresh

on:
  schedule:
    # Run on 1st of every month at 2 AM UTC
    - cron: '0 2 1 * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
        working-directory: backend
      - run: npm run holiday:refresh
        working-directory: backend
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_USERNAME: ${{ secrets.DB_USERNAME }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
          DB_DATABASE: ${{ secrets.DB_DATABASE }}
```

### Option 4: Cloud Function (Serverless)

Deploy as a scheduled cloud function on:
- AWS Lambda + EventBridge
- Google Cloud Functions + Cloud Scheduler
- Azure Functions + Timer Trigger

## Country Codes

The API supports ISO 3166-1 alpha-2 country codes. Common examples:

| Code | Country |
|------|---------|
| DE | Germany |
| US | United States |
| GB | United Kingdom |
| FR | France |
| IT | Italy |
| ES | Spain |
| AT | Austria |
| CH | Switzerland |
| NL | Netherlands |
| BE | Belgium |
| SE | Sweden |
| NO | Norway |
| DK | Denmark |
| FI | Finland |
| PL | Poland |
| CZ | Czech Republic |
| JP | Japan |
| CN | China |
| IN | India |
| AU | Australia |
| CA | Canada |
| BR | Brazil |
| MX | Mexico |
| AR | Argentina |

Full list: Run `npm run holiday:crawl -- --list-countries`

## Examples

### Example 1: Setup for Germany
```bash
# Fetch holidays for Germany 2024-2026
npm run holiday:crawl -- --country DE --years 2024,2025,2026
```

### Example 2: Setup for Multiple Countries
```bash
# Initialize common European countries
npm run holiday:init

# Or manually add more
npm run holiday:crawl -- --country IT --year 2025
npm run holiday:crawl -- --country ES --year 2025
npm run holiday:crawl -- --country PL --year 2025
```

### Example 3: Update Stale Data
```bash
# Check what needs updating
npm run holiday:crawl -- --metadata

# Refresh everything older than 3 months
npm run holiday:refresh
```

### Example 4: API Integration
```typescript
// In your frontend code
const response = await fetch('/api/holidays/DE/2025');
const holidays = await response.json();

// Display holidays
holidays.forEach(holiday => {
  console.log(`${holiday.date}: ${holiday.name}`);
});
```

## Programmatic Usage

### Using the Service in Code

```typescript
import { HolidayCrawlerService } from './services/holiday-crawler.service.js';

const crawler = new HolidayCrawlerService();

// Fetch holidays for a country/year
const result = await crawler.crawlHolidays('DE', 2025);
console.log(result.message);

// Check if refresh needed
const needsRefresh = await crawler.needsRefresh('US', 2025);

// Get all available countries
const countries = await crawler.getAvailableCountries();

// Refresh outdated data
const refreshResult = await crawler.refreshOutdatedHolidays();
```

### Using in CleanupService

```typescript
import { CleanupService } from './services/cleanup.service.js';

const cleanup = new CleanupService();

// Run holiday refresh
await cleanup.refreshHolidays();

// Run all maintenance tasks (holidays + cleanup)
await cleanup.runAllMaintenanceTasks();
```

## Troubleshooting

### API Rate Limiting
If you get rate limited:
- The service adds 500ms-1000ms delays between requests
- For bulk operations, consider running overnight
- Contact Nager.Date if you need higher limits

### No Data Returned
If `crawlHolidays` returns 0 holidays:
- Check country code is valid (use `--list-countries`)
- Check year is reasonable (API typically supports 1900-2100)
- Some countries may have limited data for certain years

### Database Connection Issues
```bash
# Verify database is accessible
psql -h localhost -U clock_user -d clock_db

# Check environment variables
echo $DB_HOST $DB_USERNAME
```

### Service Not Updating
If data isn't refreshing automatically:
1. Check `HolidayMetadata` table for `last_fetched_at` dates
2. Verify 3-month threshold logic
3. Use `--force` flag to bypass cache
4. Check logs for errors

## Performance Considerations

- **API Calls**: ~100-500ms per request
- **Database**: Indexed on `country` and `year`
- **Batch Operations**: Use delays to avoid overwhelming API
- **Caching**: Data is cached for 3 months by default

## Security Notes

- No authentication required for Nager.Date API
- Public holiday data is not sensitive
- Consider adding authentication to admin endpoints (`/crawl`, `/refresh`)
- Rate limiting recommended for production

## Future Enhancements

Potential improvements:
- [ ] Support for regional holidays (states/provinces)
- [ ] Multiple API sources (fallback)
- [ ] Holiday categorization (national, religious, etc.)
- [ ] Webhook notifications on refresh
- [ ] Dashboard for monitoring
- [ ] Configurable refresh interval
- [ ] Partial updates (only changed holidays)

## References

- Nager.Date API: https://date.nager.at/
- ISO 3166-1 Country Codes: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
- TypeORM Documentation: https://typeorm.io/

---

**Created:** November 2025  
**Version:** 1.0.0
