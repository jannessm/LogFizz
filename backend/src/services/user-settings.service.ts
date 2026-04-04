import { AppDataSource } from '../config/database.js';
import { UserSettings } from '../entities/UserSettings.js';
import type { UserSettings as UserSettingsType, StatisticsEmailFrequency } from '../../../lib/types/index.js';
import dayjs from '../../../lib/utils/dayjs.js';

export class UserSettingsService {
  private userSettingsRepository = AppDataSource.getRepository(UserSettings);

  /**
   * Get user settings by user ID
   */
  async getSettings(userId: string): Promise<UserSettings | null> {
    return this.userSettingsRepository.findOne({ where: { user_id: userId } });
  }

  /**
   * Get or create user settings with defaults
   */
  async getOrCreateSettings(userId: string): Promise<UserSettings> {
    let settings = await this.userSettingsRepository.findOne({ where: { user_id: userId } });
    
    if (!settings) {
      settings = this.userSettingsRepository.create({
        user_id: userId,
        language: 'en',
        locale: 'en-US',
        statistics_email_frequency: 'none',
      });
      await this.userSettingsRepository.save(settings);
      // Reload to get auto-generated fields
      const reloadedSettings = await this.userSettingsRepository.findOne({ where: { id: settings.id } });
      if (!reloadedSettings) {
        throw new Error('Failed to create user settings');
      }
      return reloadedSettings;
    }
    
    return settings;
  }

  /**
   * Update user settings
   */
  async updateSettings(
    userId: string, 
    updates: Partial<Pick<UserSettingsType, 'language' | 'locale' | 'first_day_of_week' | 'statistics_email_frequency' | 'setup_completed'>>
  ): Promise<UserSettings> {
    let settings = await this.getOrCreateSettings(userId);
    
    if (updates.language !== undefined) {
      settings.language = updates.language;
    }
    if (updates.locale !== undefined) {
      settings.locale = updates.locale;
    }
    if (updates.first_day_of_week !== undefined) {
      settings.first_day_of_week = updates.first_day_of_week;
    }
    if (updates.statistics_email_frequency !== undefined) {
      settings.statistics_email_frequency = updates.statistics_email_frequency;
    }
    if (updates.setup_completed !== undefined) {
      settings.setup_completed = updates.setup_completed;
    }
    
    await this.userSettingsRepository.save(settings);
    return settings;
  }

  /**
   * Get all user settings with a specific statistics email frequency
   */
  async getSettingsByFrequency(frequency: StatisticsEmailFrequency): Promise<UserSettings[]> {
    return this.userSettingsRepository.find({
      where: { statistics_email_frequency: frequency },
      relations: ['user'],
    });
  }

  /**
   * Get settings for sync (returns settings updated after the given timestamp)
   */
  async getSyncChanges(userId: string, since: string): Promise<UserSettings | null> {
    const settings = await this.userSettingsRepository.findOne({
      where: { user_id: userId },
    });
    
    if (!settings) {
      return null;
    }
    
    // Check if settings were updated after 'since' timestamp
    const sinceDate = dayjs(since);
    if (dayjs(settings.updated_at).isAfter(sinceDate)) {
      return settings;
    }
    
    return null;
  }

  /**
   * Push sync changes from client
   */
  async pushSyncChanges(
    userId: string,
    clientSettings: Partial<UserSettingsType>
  ): Promise<{ settings: UserSettings; conflict?: boolean }> {
    const serverSettings = await this.getSettings(userId);
    
    if (!serverSettings) {
      // No server settings, create from client data
      const settings = await this.updateSettings(userId, {
        language: clientSettings.language,
        locale: clientSettings.locale,
        first_day_of_week: clientSettings.first_day_of_week,
        statistics_email_frequency: clientSettings.statistics_email_frequency,
        setup_completed: clientSettings.setup_completed,
      });
      return { settings };
    }
    
    // Check for conflict (server is newer)
    const clientUpdatedAt = clientSettings.updated_at ? dayjs(clientSettings.updated_at) : dayjs(0);
    if (dayjs(serverSettings.updated_at).isAfter(clientUpdatedAt)) {
      // Server is newer, return current server settings as conflict
      return { settings: serverSettings, conflict: true };
    }
    
    // Client is newer or same, update server
    const settings = await this.updateSettings(userId, {
      language: clientSettings.language,
      locale: clientSettings.locale,
      first_day_of_week: clientSettings.first_day_of_week,
      statistics_email_frequency: clientSettings.statistics_email_frequency,
      setup_completed: clientSettings.setup_completed,
    });
    return { settings };
  }
}
