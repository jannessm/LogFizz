#!/usr/bin/env tsx
/**
 * German State Holiday Crawler CLI
 * 
 * Usage:
 *   npm run holiday:state -- --state DE-BW --year 2025
 *   npm run holiday:state -- --state DE-BY --years 2024,2025,2026
 *   npm run holiday:state -- --all --year 2025
 *   npm run holiday:state -- --init
 *   npm run holiday:state -- --list-states
 *   npm run holiday:state -- --metadata
 */

import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { GermanStateHolidayCrawlerService, GERMAN_STATES, type GermanStateCode } from '../services/german-state-holiday-crawler.service.js';

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const getArg = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : undefined;
  };

  const hasFlag = (flag: string): boolean => args.includes(flag);

  try {
    // Initialize database
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('✓ Database connected\n');

    const crawler = new GermanStateHolidayCrawlerService();

    // List available German states
    if (hasFlag('--list-states')) {
      console.log('German States (Bundesländer):\n');
      Object.entries(GERMAN_STATES).forEach(([code, name]) => {
        console.log(`  ${code}: ${name}`);
      });
      console.log(`\nTotal: ${Object.keys(GERMAN_STATES).length} states`);
    }
    
    // Initialize all states for multiple years
    else if (hasFlag('--init')) {
      console.log('Initializing holidays for all German states...\n');
      await crawler.initializeAllStates();
    }
    
    // Crawl all states for a specific year
    else if (hasFlag('--all') && hasFlag('--year')) {
      const year = parseInt(getArg('--year')!);
      const force = hasFlag('--force');

      console.log(`Crawling holidays for all German states for ${year}...`);
      if (force) {
        console.log('(Force refresh enabled)\n');
      }

      const result = await crawler.crawlAllStatesForYear(year, force);
      
      console.log('\nResults:');
      result.results.forEach((r) => {
        const status = r.holidayCount > 0 ? '✓' : '✗';
        console.log(`${status} ${r.state}: ${r.holidayCount} holidays`);
      });

      if (result.success) {
        console.log('\n✓ All states crawled successfully');
      } else {
        console.log('\n⚠ Some states failed to crawl');
      }
    }
    
    // Crawl specific state and year
    else if (hasFlag('--state') && hasFlag('--year')) {
      const stateCode = getArg('--state')!.toUpperCase() as GermanStateCode;
      const year = parseInt(getArg('--year')!);
      const force = hasFlag('--force');

      if (!GERMAN_STATES[stateCode]) {
        console.error(`✗ Invalid state code: ${stateCode}`);
        console.log('\nUse --list-states to see valid state codes');
        process.exit(1);
      }

      console.log(`Crawling holidays for ${GERMAN_STATES[stateCode]} (${stateCode}) ${year}...`);
      if (force) {
        console.log('(Force refresh enabled)\n');
      }

      const result = await crawler.crawlStateHolidays(stateCode, year, force);
      
      if (result.success) {
        console.log(`\n✓ ${result.message}`);
        
        // Show holidays
        const holidays = await crawler.getStateHolidays(stateCode, year);
        console.log('\nHolidays:');
        holidays.forEach((h) => {
          const dateStr = h.date.toISOString().split('T')[0];
          console.log(`  ${dateStr}: ${h.name}`);
        });

        // Show metadata
        const metadata = await crawler.getStateMetadata(stateCode, year);
        if (metadata) {
          console.log('\nMetadata:');
          console.log(`  Last fetched: ${metadata.last_fetched_at.toISOString()}`);
          console.log(`  Holiday count: ${metadata.holiday_count}`);
          console.log(`  Source: ${metadata.source_url}`);
        }
      } else {
        console.error(`\n✗ ${result.message}`);
        process.exit(1);
      }
    }
    
    // Crawl state for multiple years
    else if (hasFlag('--state') && hasFlag('--years')) {
      const stateCode = getArg('--state')!.toUpperCase() as GermanStateCode;
      const yearsStr = getArg('--years')!;
      const years = yearsStr.split(',').map(y => parseInt(y.trim()));
      const force = hasFlag('--force');

      if (!GERMAN_STATES[stateCode]) {
        console.error(`✗ Invalid state code: ${stateCode}`);
        console.log('\nUse --list-states to see valid state codes');
        process.exit(1);
      }

      console.log(`Crawling holidays for ${GERMAN_STATES[stateCode]} (${stateCode}) years: ${years.join(', ')}...`);
      if (force) {
        console.log('(Force refresh enabled)\n');
      }

      const result = await crawler.crawlStateHolidaysForYears(stateCode, years, force);
      
      console.log('\nResults:');
      result.results.forEach((r) => {
        const status = r.holidayCount > 0 ? '✓' : '✗';
        console.log(`${status} ${r.year}: ${r.message}`);
      });
    }
    
    // Show metadata for all German states
    else if (hasFlag('--metadata')) {
      console.log('German state holiday metadata:\n');
      const metadata = await crawler.getAllStateMetadata();
      
      if (metadata.length === 0) {
        console.log('No German state holiday data found in database.');
        console.log('Run with --init to initialize all states.');
      } else {
        // Group by state
        const byState = new Map<string, typeof metadata>();
        metadata.forEach(m => {
          const state = m.state || 'Unknown';
          if (!byState.has(state)) {
            byState.set(state, []);
          }
          byState.get(state)!.push(m);
        });

        byState.forEach((records, state) => {
          const stateName = GERMAN_STATES[state as GermanStateCode] || state;
          console.log(`\n${stateName} (${state}):`);
          records.forEach((m) => {
            const daysAgo = Math.floor((Date.now() - m.last_fetched_at.getTime()) / (1000 * 60 * 60 * 24));
            const needsRefresh = daysAgo > 90 ? '⚠️ ' : '';
            console.log(`  ${needsRefresh}${m.year}: ${m.holiday_count} holidays (fetched ${daysAgo} days ago)`);
          });
        });
      }
    }
    
    // Show help
    else {
      console.log('German State Holiday Crawler CLI\n');
      console.log('Usage:');
      console.log('  --list-states                    List all German state codes');
      console.log('  --init                           Initialize holidays for all states (3 years)');
      console.log('  --all --year <YEAR>              Crawl all states for a specific year');
      console.log('  --state <CODE> --year <YEAR>     Crawl specific state and year');
      console.log('  --state <CODE> --years <YEARS>   Crawl state for multiple years');
      console.log('  --force                          Force refresh even if data is recent');
      console.log('  --metadata                       Show all German state holiday metadata');
      console.log('\nState Codes:');
      console.log('  DE-BW (Baden-Württemberg), DE-BY (Bayern), DE-BE (Berlin), etc.');
      console.log('  Use --list-states for complete list');
      console.log('\nExamples:');
      console.log('  npm run holiday:state -- --list-states');
      console.log('  npm run holiday:state -- --init');
      console.log('  npm run holiday:state -- --state DE-BW --year 2025');
      console.log('  npm run holiday:state -- --state DE-BY --years 2024,2025,2026');
      console.log('  npm run holiday:state -- --all --year 2025');
      console.log('  npm run holiday:state -- --metadata');
    }

    await AppDataSource.destroy();
    console.log('\n✓ Database connection closed');

  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  }
}

main();
