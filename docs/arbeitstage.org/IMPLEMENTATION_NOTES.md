# Implementation Notes for German State Holiday Crawler

This document describes the implementation of the German state-specific holiday crawler based on the arbeitstage.org example.

## Background

The file `Feiertage 2025.webarchive` in this directory is an archived example from arbeitstage.org showing how German holidays are organized by state (Bundesland). Germany has 16 federal states, and public holidays can vary significantly between them.

## Implementation Approach

Instead of web scraping arbeitstage.org, we implemented a solution using the **Nager.Date API** which provides:
- Comprehensive holiday data for 100+ countries including Germany
- **County codes** that correspond to German state codes (e.g., "DE-BW" for Baden-Württemberg)
- Free, reliable API without authentication requirements

## Key Components

### 1. Database Schema Extension
- Added `state` field to `Holiday` entity (nullable)
- Added `state` field to `HolidayMetadata` entity (nullable)
- Created migration `1731445200000-AddStateToHolidays.ts`
- Added composite index on (country, state, year)

### 2. German State Holiday Crawler Service
File: `backend/src/services/german-state-holiday-crawler.service.ts`

Features:
- Supports all 16 German states with proper state codes
- Fetches holidays from Nager.Date API
- Filters holidays by county codes (state information)
- Handles both national and state-specific holidays
- Intelligent caching (3-month refresh interval)
- Batch operations for multiple states/years

### 3. CLI Script
File: `backend/src/scripts/german-state-holiday-crawler.ts`

Commands:
```bash
# List all German states
npm run holiday:state -- --list-states

# Initialize all states (recommended for setup)
npm run holiday:state:init

# Crawl specific state and year
npm run holiday:state -- --state DE-BW --year 2025

# Crawl all states for one year
npm run holiday:state -- --all --year 2025

# View metadata
npm run holiday:state -- --metadata
```

### 4. Updated Services
File: `backend/src/services/holiday.service.ts`

- Extended `getHolidays()` to accept optional `state` parameter
- Extended `addHoliday()` to accept optional `state` parameter
- Extended `getWorkingDaysSummary()` to support state-specific calculations

## URL Structure Analysis

From the arbeitstage.org example, the URL structure is:
```
arbeitstage.org/feiertage-<year>/
arbeitstage.org/<state>/feiertage-<state>/
```

However, instead of scraping these pages, we use the API approach which is:
- More reliable (structured data)
- Easier to maintain (no HTML parsing)
- Official source (Nager.Date is a recognized holiday API)
- Respects rate limits and best practices

## German States Supported

All 16 German federal states (Bundesländer):

1. **DE-BW** - Baden-Württemberg
2. **DE-BY** - Bayern (Bavaria)
3. **DE-BE** - Berlin
4. **DE-BB** - Brandenburg
5. **DE-HB** - Bremen
6. **DE-HH** - Hamburg
7. **DE-HE** - Hessen (Hesse)
8. **DE-MV** - Mecklenburg-Vorpommern
9. **DE-NI** - Niedersachsen (Lower Saxony)
10. **DE-NW** - Nordrhein-Westfalen (North Rhine-Westphalia)
11. **DE-RP** - Rheinland-Pfalz (Rhineland-Palatinate)
12. **DE-SL** - Saarland
13. **DE-SN** - Sachsen (Saxony)
14. **DE-ST** - Sachsen-Anhalt (Saxony-Anhalt)
15. **DE-SH** - Schleswig-Holstein
16. **DE-TH** - Thüringen (Thuringia)

## How It Works

1. **Fetch**: Call Nager.Date API for Germany and a specific year
2. **Filter**: Parse county codes to determine which holidays apply to which states
3. **Store**: Save holidays with state information to the database
4. **Cache**: Track last fetch date in metadata to avoid unnecessary API calls

Example API response structure:
```json
{
  "date": "2025-01-06",
  "name": "Epiphany",
  "localName": "Heilige Drei Könige",
  "countryCode": "DE",
  "counties": ["DE-BW", "DE-BY", "DE-ST"],
  "fixed": true,
  "global": false
}
```

## Examples of State-Specific Holidays

**National Holidays** (all states):
- Neujahr (New Year's Day)
- Karfreitag (Good Friday)
- Tag der Deutschen Einheit (German Unity Day)
- Christmas Days

**State-Specific Examples**:
- **Heilige Drei Könige** (Epiphany) - Only BW, BY, ST
- **Fronleichnam** (Corpus Christi) - Only BW, BY, HE, NW, RP, SL
- **Reformationstag** (Reformation Day) - BB, MV, SN, ST, TH
- **Allerheiligen** (All Saints' Day) - BW, BY, NW, RP, SL

**Unique State Holidays**:
- **Berlin**: Internationaler Frauentag (Women's Day) - March 8
- **Thuringia**: Weltkindertag (World Children's Day) - September 20

## Testing

To test the implementation:

1. **Initialize all states**:
   ```bash
   npm run holiday:state:init
   ```

2. **Test specific state**:
   ```bash
   npm run holiday:state -- --state DE-BW --year 2025
   ```

3. **View metadata**:
   ```bash
   npm run holiday:state -- --metadata
   ```

## Documentation

Complete documentation available in:
- `docs/GERMAN_STATE_HOLIDAYS.md` - Comprehensive guide
- `docs/HOLIDAY_CRAWLER.md` - Base holiday crawler (updated with reference)

## Advantages of This Approach

1. **API-based**: More reliable than web scraping
2. **Maintainable**: No HTML parsing or DOM manipulation
3. **Scalable**: Can extend to other countries with state variations
4. **Cached**: 3-month caching reduces API load
5. **Official**: Uses recognized holiday API (Nager.Date)
6. **Type-safe**: Full TypeScript implementation
7. **CLI**: Easy command-line management
8. **Documented**: Comprehensive documentation

## Future Enhancements

Potential improvements:
- [ ] REST API endpoints for state-specific holidays
- [ ] Automatic user state detection from profile
- [ ] State comparison views
- [ ] Calendar export (iCal format)
- [ ] Webhook notifications for new holidays
- [ ] Support for other countries with state variations

---

**Implementation Date**: November 2025  
**Based On**: arbeitstage.org/feiertage-2025/ example  
**API Source**: Nager.Date API (https://date.nager.at/)
