#!/usr/bin/env tsx
/**
 * Holiday Crawler CLI
 * 
 * Usage:
 *   npm run holiday:crawl -- --country DE --year 2025
 *   npm run holiday:crawl -- --init
 *   npm run holiday:crawl -- --refresh
 *   npm run holiday:crawl -- --list-countries
 */

import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';
import { HolidayCrawlerService } from '../services/holiday-crawler.service.js';
import { CleanupService } from '../services/cleanup.service.js';

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

    const crawler = new HolidayCrawlerService();
    const cleanup = new CleanupService();

    // List available countries
    if (hasFlag('--list-countries')) {
      console.log('Fetching available countries...\n');
      const countries = await crawler.getAvailableCountries();
      console.log('Available country codes:');
      console.log(countries.sort().join(', '));
      console.log(`\nTotal: ${countries.length} countries`);
    }
    
    // Initialize common holidays
    else if (hasFlag('--init')) {
      console.log('Initializing holidays for common countries...\n');
      await crawler.initializeCommonHolidays();
    }
    
    // Refresh outdated holidays
    else if (hasFlag('--refresh')) {
      console.log('Refreshing outdated holiday data...\n');
      await cleanup.refreshHolidays();
    }
    
    // Crawl specific country and year
    else if (hasFlag('--country') && hasFlag('--year')) {
      const country = getArg('--country')!.toUpperCase();
      const year = parseInt(getArg('--year')!);
      const force = hasFlag('--force');

      console.log(`Crawling holidays for ${country} ${year}...`);
      if (force) {
        console.log('(Force refresh enabled)\n');
      }

      const result = await crawler.crawlHolidays(country, year, force);
      
      if (result.success) {
        console.log(`\n✓ ${result.message}`);
        
        // Show metadata
        const metadata = await crawler.getMetadata(country, year);
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
    
    // Crawl country for multiple years
    else if (hasFlag('--country') && hasFlag('--years')) {
      const country = getArg('--country')!.toUpperCase();
      const yearsStr = getArg('--years')!;
      const years = yearsStr.split(',').map(y => parseInt(y.trim()));
      const force = hasFlag('--force');

      console.log(`Crawling holidays for ${country} years: ${years.join(', ')}...`);
      if (force) {
        console.log('(Force refresh enabled)\n');
      }

      const result = await crawler.crawlHolidaysForYears(country, years, force);
      
      console.log('\nResults:');
      result.results.forEach((r: { year: number; holidayCount: number; message: string }) => {
        const status = r.holidayCount > 0 ? '✓' : '✗';
        console.log(`${status} ${r.year}: ${r.message}`);
      });
    }
    
    // Show metadata
    else if (hasFlag('--metadata')) {
      console.log('Holiday metadata:\n');
      const metadata = await crawler.getAllMetadata();
      
      if (metadata.length === 0) {
        console.log('No holiday data found in database.');
      } else {
        metadata.forEach((m) => {
          const daysAgo = Math.floor((Date.now() - m.last_fetched_at.getTime()) / (1000 * 60 * 60 * 24));
          const needsRefresh = daysAgo > 90 ? '⚠️ ' : '';
          console.log(`${needsRefresh}${m.country} ${m.year}: ${m.holiday_count} holidays (fetched ${daysAgo} days ago)`);
        });
      }
    }
    
    // Show help
    else {
      console.log('Holiday Crawler CLI\n');
      console.log('Usage:');
      console.log('  --list-countries              List all available country codes');
      console.log('  --init                        Initialize holidays for common countries');
      console.log('  --refresh                     Refresh outdated holiday data (>3 months)');
      console.log('  --country <CODE> --year <YEAR>  Crawl holidays for specific country/year');
      console.log('  --country <CODE> --years <YEARS> Crawl for multiple years (comma-separated)');
      console.log('  --force                       Force refresh even if data is recent');
      console.log('  --metadata                    Show all holiday metadata');
      console.log('\nExamples:');
      console.log('  npm run holiday:crawl -- --list-countries');
      console.log('  npm run holiday:crawl -- --init');
      console.log('  npm run holiday:crawl -- --country DE --year 2025');
      console.log('  npm run holiday:crawl -- --country US --years 2024,2025,2026');
      console.log('  npm run holiday:crawl -- --country GB --year 2025 --force');
      console.log('  npm run holiday:crawl -- --refresh');
      console.log('  npm run holiday:crawl -- --metadata');
    }

    await AppDataSource.destroy();
    console.log('\n✓ Database connection closed');

  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  }
}

main();
