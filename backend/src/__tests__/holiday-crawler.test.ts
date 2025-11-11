import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppDataSource } from '../config/database.js';
import { HolidayCrawlerService } from '../services/holiday-crawler.service.js';
import { HolidayMetadata } from '../entities/HolidayMetadata.js';

describe('Holiday Crawler Service', () => {
  let crawler: HolidayCrawlerService;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    crawler = new HolidayCrawlerService();

    // Clean up test data
    const metadataRepo = AppDataSource.getRepository(HolidayMetadata);
    await metadataRepo.delete({ country: 'TEST' });
  });

  afterAll(async () => {
    // Clean up test data
    const metadataRepo = AppDataSource.getRepository(HolidayMetadata);
    await metadataRepo.delete({ country: 'TEST' });
  });

  it('should get available countries', async () => {
    const countries = await crawler.getAvailableCountries();
    
    expect(countries).toBeDefined();
    expect(Array.isArray(countries)).toBe(true);
    expect(countries.length).toBeGreaterThan(0);
    
    // Should include common countries
    expect(countries).toContain('DE');
    expect(countries).toContain('US');
    expect(countries).toContain('GB');
  });

  it('should crawl holidays for a valid country and year', async () => {
    const result = await crawler.crawlHolidays('DE', 2025);
    
    expect(result.success).toBe(true);
    expect(result.holidayCount).toBeGreaterThan(0);
    expect(result.message).toContain('Successfully');
  }, 10000); // Longer timeout for API call

  it('should store metadata after crawling', async () => {
    await crawler.crawlHolidays('FR', 2025);
    
    const metadata = await crawler.getMetadata('FR', 2025);
    
    expect(metadata).toBeDefined();
    expect(metadata?.country).toBe('FR');
    expect(metadata?.year).toBe(2025);
    expect(metadata?.holiday_count).toBeGreaterThan(0);
    expect(metadata?.last_fetched_at).toBeDefined();
  }, 10000);

  it('should not refresh if data is recent', async () => {
    // First crawl
    await crawler.crawlHolidays('GB', 2025);
    
    // Should not need refresh
    const needsRefresh = await crawler.needsRefresh('GB', 2025);
    expect(needsRefresh).toBe(false);
    
    // Try crawling again without force
    const result = await crawler.crawlHolidays('GB', 2025, false);
    expect(result.message).toContain('up to date');
  }, 10000);

  it('should refresh when forced', async () => {
    const result = await crawler.crawlHolidays('US', 2025, true);
    
    expect(result.success).toBe(true);
    expect(result.holidayCount).toBeGreaterThan(0);
  }, 10000);

  it('should handle multiple years', async () => {
    const result = await crawler.crawlHolidaysForYears('AT', [2024, 2025], false);
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].year).toBe(2024);
    expect(result.results[1].year).toBe(2025);
  }, 15000);

  it('should get all metadata', async () => {
    const metadata = await crawler.getAllMetadata();
    
    expect(Array.isArray(metadata)).toBe(true);
    expect(metadata.length).toBeGreaterThan(0);
  });

  it('should detect need for refresh on old data', async () => {
    // Create metadata with old date
    const metadataRepo = AppDataSource.getRepository(HolidayMetadata);
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 4); // 4 months ago
    
    const oldMetadata = metadataRepo.create({
      country: 'TEST',
      year: 2020,
      last_fetched_at: oldDate,
      holiday_count: 5,
    });
    
    await metadataRepo.save(oldMetadata);
    
    const needsRefresh = await crawler.needsRefresh('TEST', 2020);
    expect(needsRefresh).toBe(true);
    
    // Clean up
    await metadataRepo.delete({ country: 'TEST' });
  });
});
