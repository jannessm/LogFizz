# German State Holiday Crawler

This document describes the German state-specific holiday crawler functionality, which allows fetching and managing public holidays for each of Germany's 16 federal states (Bundesländer).

## Overview

Germany has a unique system where public holidays can vary significantly between states. While some holidays like New Year's Day are national holidays, many others like Epiphany (Heilige Drei Könige) or Reformation Day (Reformationstag) are only observed in specific states.

The German State Holiday Crawler extends the base holiday crawler to support state-specific holiday data.

## German States (Bundesländer)

The system supports all 16 German states:

| State Code | State Name | German Name |
|------------|------------|-------------|
| DE-BW | Baden-Württemberg | Baden-Württemberg |
| DE-BY | Bavaria | Bayern |
| DE-BE | Berlin | Berlin |
| DE-BB | Brandenburg | Brandenburg |
| DE-HB | Bremen | Bremen |
| DE-HH | Hamburg | Hamburg |
| DE-HE | Hesse | Hessen |
| DE-MV | Mecklenburg-Vorpommern | Mecklenburg-Vorpommern |
| DE-NI | Lower Saxony | Niedersachsen |
| DE-NW | North Rhine-Westphalia | Nordrhein-Westfalen |
| DE-RP | Rhineland-Palatinate | Rheinland-Pfalz |
| DE-SL | Saarland | Saarland |
| DE-SN | Saxony | Sachsen |
| DE-ST | Saxony-Anhalt | Sachsen-Anhalt |
| DE-SH | Schleswig-Holstein | Schleswig-Holstein |
| DE-TH | Thuringia | Thüringen |

## Database Schema

The holiday crawler uses an extended schema that includes state information:

### Holiday Table
```typescript
{
  id: UUID
  country: string       // "DE" for Germany
  state: string?        // e.g., "DE-BW", "DE-BY", null for national
  date: Date
  name: string
  year: number
}
```

### HolidayMetadata Table
```typescript
{
  id: UUID
  country: string
  state: string?        // State code or null
  year: number
  last_fetched_at: Date
  holiday_count: number
  source_url: string
  created_at: Date
  updated_at: Date
}
```

## CLI Usage

### List Available States
```bash
npm run holiday:state -- --list-states
```

Shows all 16 German state codes and their full names.

### Initialize All States
```bash
npm run holiday:state:init
```

Fetches holidays for all 16 German states for the previous, current, and next year. This is the recommended way to set up the system initially.

### Crawl Specific State and Year
```bash
npm run holiday:state -- --state DE-BW --year 2025
```

Fetches holidays for Baden-Württemberg in 2025.

### Crawl State for Multiple Years
```bash
npm run holiday:state -- --state DE-BY --years 2024,2025,2026
```

Fetches holidays for Bavaria for years 2024-2026.

### Crawl All States for One Year
```bash
npm run holiday:state -- --all --year 2025
```

Fetches holidays for all 16 German states for 2025.

### Force Refresh
```bash
npm run holiday:state -- --state DE-BE --year 2025 --force
```

Forces a refresh of holiday data even if it was recently fetched (bypasses 3-month cache).

### View Metadata
```bash
npm run holiday:state -- --metadata
```

Shows all German state holiday data in the database with last fetch dates. Entries older than 90 days are marked with ⚠️.

## API Integration

### Get State Holidays Programmatically

```typescript
import { GermanStateHolidayCrawlerService } from './services/german-state-holiday-crawler.service.js';

const crawler = new GermanStateHolidayCrawlerService();

// Fetch holidays for Bavaria 2025
const result = await crawler.crawlStateHolidays('DE-BY', 2025);
console.log(result.message);

// Get holidays from database
const holidays = await crawler.getStateHolidays('DE-BY', 2025);
holidays.forEach(h => {
  console.log(`${h.date.toISOString().split('T')[0]}: ${h.name}`);
});
```

### Using HolidayService with States

```typescript
import { HolidayService } from './services/holiday.service.js';

const service = new HolidayService();

// Get holidays for a specific state
const holidays = await service.getHolidays('DE', 2025, 'DE-BW');

// Get working days summary for a state
const summary = await service.getWorkingDaysSummary('DE', 2025, 'DE-BW');
console.log(`Working days in Baden-Württemberg 2025: ${summary.workingDays}`);
```

## How It Works

### Data Source
The crawler uses the **Nager.Date API** which provides county codes for holidays. These county codes correspond to German state codes (e.g., "DE-BW" for Baden-Württemberg).

### Filtering Logic
When crawling holidays for a specific state:

1. Fetch all holidays for Germany from the API
2. Filter holidays based on county codes:
   - **Global holidays** (no county codes) → Included in all states
   - **State-specific holidays** → Only included if the state code matches

### Example Holiday Data

```typescript
// API returns this structure
{
  date: "2025-01-06",
  name: "Epiphany",
  localName: "Heilige Drei Könige",
  countryCode: "DE",
  counties: ["DE-BW", "DE-BY", "DE-ST"], // Only these states
  fixed: true,
  global: false
}

// System stores separately for each state
// DE-BW, DE-BY, DE-ST will each get this holiday
// Other states will not
```

## Holiday Examples by State

### National Holidays (All States)
- Neujahr (New Year's Day) - January 1
- Karfreitag (Good Friday)
- Ostermontag (Easter Monday)
- Tag der Arbeit (Labour Day) - May 1
- Christi Himmelfahrt (Ascension Day)
- Pfingstmontag (Whit Monday)
- Tag der Deutschen Einheit (German Unity Day) - October 3
- 1. Weihnachtstag (Christmas Day) - December 25
- 2. Weihnachtstag (Boxing Day) - December 26

### State-Specific Examples

**Bayern (DE-BY):**
- Heilige Drei Könige (Epiphany) - January 6
- Fronleichnam (Corpus Christi)
- Mariä Himmelfahrt (Assumption of Mary) - August 15
- Allerheiligen (All Saints' Day) - November 1

**Berlin (DE-BE):**
- Internationaler Frauentag (International Women's Day) - March 8

**Brandenburg (DE-BB):**
- Reformationstag (Reformation Day) - October 31

**Saarland (DE-SL):**
- Fronleichnam (Corpus Christi)
- Mariä Himmelfahrt (Assumption of Mary) - August 15
- Allerheiligen (All Saints' Day) - November 1

## Maintenance and Updates

### Automatic Refresh
Holiday data is automatically cached for 3 months. After this period, the system will automatically fetch fresh data when requested.

### Manual Refresh
To force a refresh of all state data:

```bash
# Refresh all states for current year
npm run holiday:state -- --all --year 2025 --force

# Or initialize all states for 3 years
npm run holiday:state:init
```

### Scheduled Jobs
For production, set up a scheduled task to refresh state holiday data:

```bash
# Cron job to run monthly
0 2 1 * * cd /path/to/clock/backend && npm run holiday:state:init
```

## REST API Endpoints

The existing holiday API endpoints support state filtering:

### Get State Holidays
```bash
# Get holidays for Baden-Württemberg 2025
curl http://localhost:3000/api/holidays/DE/2025?state=DE-BW
```

### Get Working Days for State
```bash
# Get working days summary for Bavaria 2025
curl http://localhost:3000/api/holidays/DE/2025/working-days?state=DE-BY
```

## Comparison with Base Crawler

| Feature | Base Holiday Crawler | German State Crawler |
|---------|---------------------|---------------------|
| Scope | Country-level | State-level for Germany |
| Data Source | Nager.Date API | Nager.Date API (county codes) |
| Use Case | General country holidays | German state-specific holidays |
| State Support | No | Yes (16 German states) |
| CLI Script | `holiday-crawler.ts` | `german-state-holiday-crawler.ts` |
| NPM Commands | `holiday:crawl`, `holiday:init` | `holiday:state`, `holiday:state:init` |

## Troubleshooting

### No Data Returned
If state crawling returns 0 holidays:
- Verify state code is correct (use `--list-states`)
- Check if API is accessible
- Try force refresh with `--force` flag

### Duplicate Data
If you have both country-level and state-level data:
- State-level data takes precedence for German states
- Use state filtering in queries to get correct data
- You can delete old country-level German data if needed

### Performance
- Crawling all states takes ~10-15 seconds (with API delays)
- Data is cached for 3 months to minimize API calls
- Use batch operations (`--all` or `--init`) for efficiency

## Migration Guide

If you have existing country-level German holiday data:

1. **Keep old data** (optional):
   ```bash
   # Old data remains in DB with state = null
   ```

2. **Fetch new state-specific data**:
   ```bash
   npm run holiday:state:init
   ```

3. **Update queries** to include state parameter:
   ```typescript
   // Old: country-level
   const holidays = await service.getHolidays('DE', 2025);
   
   // New: state-level
   const holidays = await service.getHolidays('DE', 2025, 'DE-BW');
   ```

4. **Clean up old data** (if desired):
   ```sql
   DELETE FROM holidays WHERE country = 'DE' AND state IS NULL;
   DELETE FROM holiday_metadata WHERE country = 'DE' AND state IS NULL;
   ```

## Future Enhancements

Potential improvements:
- [ ] Support for other countries with state/province variations
- [ ] Automatic detection of user's state from profile
- [ ] State comparison view (show differences between states)
- [ ] Historical holiday data analysis
- [ ] Export state holidays to calendar formats (iCal, Google Calendar)

## References

- Nager.Date API: https://date.nager.at/
- German Public Holidays: https://en.wikipedia.org/wiki/Public_holidays_in_Germany
- Arbeitstage.org (inspiration): https://www.arbeitstage.org/

---

**Created:** November 2025  
**Version:** 1.0.0
