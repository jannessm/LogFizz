import { AppDataSource } from '../config/database.js';
import { Holiday } from '../entities/Holiday.js';
import { HolidayMetadata } from '../entities/HolidayMetadata.js';
import { MoreThan } from 'typeorm';

interface HolidayData {
  date: Date;
  name: string;
  localName?: string;
  countryCode?: string;
  fixed: boolean;
  global: boolean;
  type?: string;
}

/**
 * Holiday Crawler Service
 * 
 * Fetches public holiday data from external APIs and stores in database.
 * Automatically refreshes data older than 3 months.
 */
export class HolidayCrawlerService {
  private holidayRepository = AppDataSource.getRepository(Holiday);
  private metadataRepository = AppDataSource.getRepository(HolidayMetadata);

  // Using Nager.Date API - a free public holidays API
  private readonly API_BASE_URL = 'https://date.nager.at/api/v3';
  
  /**
   * Check if holiday data needs to be refreshed
   * Returns true if data is older than 3 months or doesn't exist
   */
  async needsRefresh(country: string, year: number): Promise<boolean> {
    const metadata = await this.metadataRepository.findOne({
      where: { country, year },
    });

    if (!metadata) {
      return true;
    }

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return metadata.last_fetched_at < threeMonthsAgo;
  }

  /**
   * Get all available country codes from the API
   */
  async getAvailableCountries(): Promise<string[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/AvailableCountries`);
      if (!response.ok) {
        throw new Error(`Failed to fetch available countries: ${response.statusText}`);
      }
      
      const countries = await response.json() as Array<{ countryCode: string }>;
      return countries.map((c) => c.countryCode);
    } catch (error) {
      console.error('Error fetching available countries:', error);
      return [];
    }
  }

  /**
   * Fetch holidays from Nager.Date API
   */
  private async fetchHolidaysFromAPI(country: string, year: number): Promise<HolidayData[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/PublicHolidays/${year}/${country.toUpperCase()}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`No holidays found for ${country} in ${year}`);
          return [];
        }
        throw new Error(`Failed to fetch holidays: ${response.statusText}`);
      }

      const data = await response.json() as Array<{
        date: string;
        name: string;
        localName?: string;
        countryCode?: string;
        fixed: boolean;
        global: boolean;
        type?: string;
      }>;
      
      return data.map((holiday) => ({
        date: new Date(holiday.date),
        name: holiday.name,
        localName: holiday.localName,
        countryCode: holiday.countryCode,
        fixed: holiday.fixed,
        global: holiday.global,
        type: holiday.type,
      }));
    } catch (error) {
      console.error(`Error fetching holidays for ${country} ${year}:`, error);
      throw error;
    }
  }

  /**
   * Crawl and store holidays for a specific country and year
   */
  async crawlHolidays(country: string, year: number, forceRefresh = false): Promise<{
    success: boolean;
    holidayCount: number;
    message: string;
  }> {
    try {
      // Check if refresh is needed
      if (!forceRefresh) {
        const needsUpdate = await this.needsRefresh(country, year);
        if (!needsUpdate) {
          const existing = await this.holidayRepository.count({
            where: { country, year },
          });
          return {
            success: true,
            holidayCount: existing,
            message: `Holidays for ${country} ${year} are up to date (last fetched within 3 months)`,
          };
        }
      }

      console.log(`Fetching holidays for ${country} ${year}...`);
      
      // Fetch holidays from API
      const holidayData = await this.fetchHolidaysFromAPI(country, year);

      if (holidayData.length === 0) {
        return {
          success: false,
          holidayCount: 0,
          message: `No holidays found for ${country} ${year}`,
        };
      }

      // Delete existing holidays for this country/year
      await this.holidayRepository.delete({ country, year });

      // Insert new holidays
      const holidays = holidayData.map(data => 
        this.holidayRepository.create({
          country,
          date: data.date,
          name: data.localName || data.name,
          year,
        })
      );

      await this.holidayRepository.save(holidays);

      // Update or create metadata
      let metadata = await this.metadataRepository.findOne({
        where: { country, year },
      });

      if (metadata) {
        metadata.last_fetched_at = new Date();
        metadata.holiday_count = holidays.length;
        metadata.source_url = `${this.API_BASE_URL}/PublicHolidays/${year}/${country}`;
      } else {
        metadata = this.metadataRepository.create({
          country,
          year,
          last_fetched_at: new Date(),
          holiday_count: holidays.length,
          source_url: `${this.API_BASE_URL}/PublicHolidays/${year}/${country}`,
        });
      }

      await this.metadataRepository.save(metadata);

      console.log(`✓ Successfully crawled ${holidays.length} holidays for ${country} ${year}`);

      return {
        success: true,
        holidayCount: holidays.length,
        message: `Successfully fetched ${holidays.length} holidays for ${country} ${year}`,
      };
    } catch (error) {
      console.error(`Error crawling holidays for ${country} ${year}:`, error);
      return {
        success: false,
        holidayCount: 0,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Crawl holidays for multiple years (e.g., previous, current, next year)
   */
  async crawlHolidaysForYears(country: string, years: number[], forceRefresh = false): Promise<{
    success: boolean;
    results: Array<{ year: number; holidayCount: number; message: string }>;
  }> {
    const results = [];

    for (const year of years) {
      const result = await this.crawlHolidays(country, year, forceRefresh);
      results.push({
        year,
        holidayCount: result.holidayCount,
        message: result.message,
      });

      // Add a small delay between requests to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const allSuccessful = results.every(r => r.holidayCount > 0);

    return {
      success: allSuccessful,
      results,
    };
  }

  /**
   * Refresh all outdated holiday data (older than 3 months)
   * This should be run periodically (e.g., via cron job)
   */
  async refreshOutdatedHolidays(): Promise<{
    refreshed: number;
    failed: number;
    details: Array<{ country: string; year: number; success: boolean; message: string }>;
  }> {
    console.log('Starting refresh of outdated holiday data...');

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Find all metadata entries older than 3 months
    const outdatedMetadata = await this.metadataRepository.find({
      where: {
        last_fetched_at: MoreThan(new Date(0)), // All records
      },
    });

    const toRefresh = outdatedMetadata.filter(m => 
      m.last_fetched_at < threeMonthsAgo
    );

    console.log(`Found ${toRefresh.length} country/year combinations to refresh`);

    let refreshed = 0;
    let failed = 0;
    const details = [];

    for (const metadata of toRefresh) {
      const result = await this.crawlHolidays(metadata.country, metadata.year, true);
      
      if (result.success) {
        refreshed++;
      } else {
        failed++;
      }

      details.push({
        country: metadata.country,
        year: metadata.year,
        success: result.success,
        message: result.message,
      });

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Refresh complete: ${refreshed} refreshed, ${failed} failed`);

    return {
      refreshed,
      failed,
      details,
    };
  }

  /**
   * Initialize holidays for common countries and years
   * Useful for initial setup
   */
  async initializeCommonHolidays(): Promise<void> {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    
    // Common countries (can be expanded)
    const countries = ['DE', 'US', 'GB', 'FR', 'AT', 'CH'];

    console.log('Initializing holidays for common countries...');

    for (const country of countries) {
      console.log(`\nProcessing ${country}...`);
      await this.crawlHolidaysForYears(country, years, false);
    }

    console.log('\n✓ Holiday initialization complete');
  }

  /**
   * Get metadata for a specific country and year
   */
  async getMetadata(country: string, year: number): Promise<HolidayMetadata | null> {
    return this.metadataRepository.findOne({
      where: { country, year },
    });
  }

  /**
   * Get all metadata entries
   */
  async getAllMetadata(): Promise<HolidayMetadata[]> {
    return this.metadataRepository.find({
      order: {
        country: 'ASC',
        year: 'DESC',
      },
    });
  }
}
