import { AppDataSource } from '../config/database.js';
import { Holiday } from '../entities/Holiday.js';
import { HolidayMetadata } from '../entities/HolidayMetadata.js';

/**
 * German State-Specific Holiday Crawler Service
 * 
 * Fetches public holiday data for German states (Bundesländer) from Nager.Date API
 * which provides county codes that correspond to German states.
 */

// Mapping of German state codes to their full names
export const GERMAN_STATES = {
  'DE-BW': 'Baden-Württemberg',
  'DE-BY': 'Bayern',
  'DE-BE': 'Berlin',
  'DE-BB': 'Brandenburg',
  'DE-HB': 'Bremen',
  'DE-HH': 'Hamburg',
  'DE-HE': 'Hessen',
  'DE-MV': 'Mecklenburg-Vorpommern',
  'DE-NI': 'Niedersachsen',
  'DE-NW': 'Nordrhein-Westfalen',
  'DE-RP': 'Rheinland-Pfalz',
  'DE-SL': 'Saarland',
  'DE-SN': 'Sachsen',
  'DE-ST': 'Sachsen-Anhalt',
  'DE-SH': 'Schleswig-Holstein',
  'DE-TH': 'Thüringen',
} as const;

export type GermanStateCode = keyof typeof GERMAN_STATES;

interface HolidayData {
  date: Date;
  name: string;
  localName?: string;
  countryCode?: string;
  counties?: string[];
  fixed: boolean;
  global: boolean;
  type?: string;
}

export class GermanStateHolidayCrawlerService {
  private holidayRepository = AppDataSource.getRepository(Holiday);
  private metadataRepository = AppDataSource.getRepository(HolidayMetadata);

  private readonly API_BASE_URL = 'https://date.nager.at/api/v3';
  private readonly COUNTRY_CODE = 'DE';

  /**
   * Check if state holiday data needs to be refreshed
   */
  async needsRefresh(stateCode: string, year: number): Promise<boolean> {
    const metadata = await this.metadataRepository.findOne({
      where: { country: this.COUNTRY_CODE, state: stateCode, year },
    });

    if (!metadata) {
      return true;
    }

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return metadata.last_fetched_at < threeMonthsAgo;
  }

  /**
   * Fetch holidays from Nager.Date API for Germany
   * The API returns county codes which correspond to German states
   */
  private async fetchHolidaysFromAPI(year: number): Promise<HolidayData[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/PublicHolidays/${year}/${this.COUNTRY_CODE}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`No holidays found for Germany in ${year}`);
          return [];
        }
        throw new Error(`Failed to fetch holidays: ${response.statusText}`);
      }

      const data = await response.json() as Array<{
        date: string;
        name: string;
        localName?: string;
        countryCode?: string;
        counties?: string[];
        fixed: boolean;
        global: boolean;
        type?: string;
      }>;
      
      return data.map((holiday) => ({
        date: new Date(holiday.date),
        name: holiday.name,
        localName: holiday.localName,
        countryCode: holiday.countryCode,
        counties: holiday.counties || [],
        fixed: holiday.fixed,
        global: holiday.global,
        type: holiday.type,
      }));
    } catch (error) {
      console.error(`Error fetching holidays for Germany ${year}:`, error);
      throw error;
    }
  }

  /**
   * Crawl and store holidays for a specific German state and year
   */
  async crawlStateHolidays(stateCode: GermanStateCode, year: number, forceRefresh = false): Promise<{
    success: boolean;
    holidayCount: number;
    message: string;
  }> {
    try {
      // Validate state code
      if (!GERMAN_STATES[stateCode]) {
        return {
          success: false,
          holidayCount: 0,
          message: `Invalid state code: ${stateCode}`,
        };
      }

      // Check if refresh is needed
      if (!forceRefresh) {
        const needsUpdate = await this.needsRefresh(stateCode, year);
        if (!needsUpdate) {
          const existing = await this.holidayRepository.count({
            where: { country: this.COUNTRY_CODE, state: stateCode, year },
          });
          return {
            success: true,
            holidayCount: existing,
            message: `Holidays for ${GERMAN_STATES[stateCode]} ${year} are up to date`,
          };
        }
      }

      console.log(`Fetching holidays for ${GERMAN_STATES[stateCode]} ${year}...`);
      
      // Fetch all German holidays
      const allHolidays = await this.fetchHolidaysFromAPI(year);

      if (allHolidays.length === 0) {
        return {
          success: false,
          holidayCount: 0,
          message: `No holidays found for Germany ${year}`,
        };
      }

      // Extract state code from full state code (DE-BW -> BW)
      const shortStateCode = stateCode.split('-')[1];

      // Filter holidays for this specific state
      // A holiday is valid for a state if:
      // 1. It's a global holiday (no counties specified or empty array)
      // 2. The state code is in the counties array
      const stateHolidays = allHolidays.filter(holiday => {
        if (holiday.global || !holiday.counties || holiday.counties.length === 0) {
          return true;
        }
        return holiday.counties.includes(`DE-${shortStateCode}`) || holiday.counties.includes(shortStateCode);
      });

      if (stateHolidays.length === 0) {
        return {
          success: false,
          holidayCount: 0,
          message: `No holidays found for ${GERMAN_STATES[stateCode]} ${year}`,
        };
      }

      // Delete existing holidays for this state/year
      await this.holidayRepository.delete({ 
        country: this.COUNTRY_CODE, 
        state: stateCode, 
        year 
      });

      // Insert new holidays
      const holidays = stateHolidays.map(data => 
        this.holidayRepository.create({
          country: this.COUNTRY_CODE,
          state: stateCode,
          date: data.date,
          name: data.localName || data.name,
          year,
        })
      );

      await this.holidayRepository.save(holidays);

      // Update or create metadata
      let metadata = await this.metadataRepository.findOne({
        where: { country: this.COUNTRY_CODE, state: stateCode, year },
      });

      if (metadata) {
        metadata.last_fetched_at = new Date();
        metadata.holiday_count = holidays.length;
        metadata.source_url = `${this.API_BASE_URL}/PublicHolidays/${year}/${this.COUNTRY_CODE}`;
      } else {
        metadata = this.metadataRepository.create({
          country: this.COUNTRY_CODE,
          state: stateCode,
          year,
          last_fetched_at: new Date(),
          holiday_count: holidays.length,
          source_url: `${this.API_BASE_URL}/PublicHolidays/${year}/${this.COUNTRY_CODE}`,
        });
      }

      await this.metadataRepository.save(metadata);

      console.log(`✓ Successfully crawled ${holidays.length} holidays for ${GERMAN_STATES[stateCode]} ${year}`);

      return {
        success: true,
        holidayCount: holidays.length,
        message: `Successfully fetched ${holidays.length} holidays for ${GERMAN_STATES[stateCode]} ${year}`,
      };
    } catch (error) {
      console.error(`Error crawling holidays for ${stateCode} ${year}:`, error);
      return {
        success: false,
        holidayCount: 0,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Crawl holidays for a state across multiple years
   */
  async crawlStateHolidaysForYears(stateCode: GermanStateCode, years: number[], forceRefresh = false): Promise<{
    success: boolean;
    results: Array<{ year: number; holidayCount: number; message: string }>;
  }> {
    const results = [];

    for (const year of years) {
      const result = await this.crawlStateHolidays(stateCode, year, forceRefresh);
      results.push({
        year,
        holidayCount: result.holidayCount,
        message: result.message,
      });

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const allSuccessful = results.every(r => r.holidayCount > 0);

    return {
      success: allSuccessful,
      results,
    };
  }

  /**
   * Crawl holidays for all German states for a specific year
   */
  async crawlAllStatesForYear(year: number, forceRefresh = false): Promise<{
    success: boolean;
    results: Array<{ state: string; holidayCount: number; message: string }>;
  }> {
    console.log(`Crawling holidays for all German states for ${year}...`);
    
    const results = [];
    const stateEntries = Object.entries(GERMAN_STATES);

    for (const [stateCode, stateName] of stateEntries) {
      console.log(`\nProcessing ${stateName} (${stateCode})...`);
      const result = await this.crawlStateHolidays(stateCode as GermanStateCode, year, forceRefresh);
      
      results.push({
        state: `${stateName} (${stateCode})`,
        holidayCount: result.holidayCount,
        message: result.message,
      });

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const allSuccessful = results.every(r => r.holidayCount > 0);

    return {
      success: allSuccessful,
      results,
    };
  }

  /**
   * Initialize holidays for all German states
   */
  async initializeAllStates(): Promise<void> {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    console.log('Initializing holidays for all German states...');

    for (const year of years) {
      console.log(`\n=== Year ${year} ===`);
      await this.crawlAllStatesForYear(year, false);
    }

    console.log('\n✓ German state holiday initialization complete');
  }

  /**
   * Get metadata for a specific state and year
   */
  async getStateMetadata(stateCode: string, year: number): Promise<HolidayMetadata | null> {
    return this.metadataRepository.findOne({
      where: { country: this.COUNTRY_CODE, state: stateCode, year },
    });
  }

  /**
   * Get all state metadata
   */
  async getAllStateMetadata(): Promise<HolidayMetadata[]> {
    return this.metadataRepository.find({
      where: { country: this.COUNTRY_CODE },
      order: {
        state: 'ASC',
        year: 'DESC',
      },
    });
  }

  /**
   * Get holidays for a specific state and year from database
   */
  async getStateHolidays(stateCode: GermanStateCode, year: number): Promise<Holiday[]> {
    return this.holidayRepository.find({
      where: { country: this.COUNTRY_CODE, state: stateCode, year },
      order: { date: 'ASC' },
    });
  }

  /**
   * Check if any state needs update (>3 months since last fetch)
   */
  async needsAnyUpdate(): Promise<boolean> {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    for (const year of years) {
      for (const stateCode of Object.keys(GERMAN_STATES)) {
        const metadata = await this.metadataRepository.findOne({
          where: { country: this.COUNTRY_CODE, state: stateCode, year },
        });

        // If no metadata or outdated, update needed
        if (!metadata || metadata.last_fetched_at < threeMonthsAgo) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Auto-update holidays for last, current, and next year
   * Returns summary of updates for email notification
   */
  async autoUpdateHolidays(): Promise<{
    updatedStates: Array<{ state: string; count: number }>;
    totalHolidays: number;
    years: number[];
  }> {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    
    const updatedStates: Array<{ state: string; count: number }> = [];
    let totalHolidays = 0;

    console.log('Starting auto-update of holidays...');

    for (const year of years) {
      console.log(`\nProcessing year ${year}...`);
      
      for (const [stateCode, stateName] of Object.entries(GERMAN_STATES)) {
        const needsUpdate = await this.needsRefresh(stateCode as GermanStateCode, year);
        
        if (needsUpdate) {
          console.log(`  Updating ${stateName} (${stateCode})...`);
          const result = await this.crawlStateHolidays(stateCode as GermanStateCode, year, true);
          
          if (result.success) {
            updatedStates.push({
              state: `${stateName} (${stateCode}) - ${year}`,
              count: result.holidayCount,
            });
            totalHolidays += result.holidayCount;
          }

          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    console.log(`\nAuto-update complete: ${totalHolidays} holidays across ${updatedStates.length} state-years`);

    return {
      updatedStates,
      totalHolidays,
      years,
    };
  }
}
