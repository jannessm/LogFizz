import { AppDataSource } from '../config/database.js';
import { UserSettings } from '../entities/UserSettings.js';
import type { UserSettings as UserSettingsType, StatisticsEmailFrequency } from '../../../lib/types/index.js';

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
    updates: Partial<Pick<UserSettingsType, 'language' | 'locale' | 'first_day_of_week' | 'statistics_email_frequency'>>
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
    const sinceDate = new Date(since);
    if (settings.updated_at > sinceDate) {
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
      });
      return { settings };
    }
    
    // Check for conflict (server is newer)
    const clientUpdatedAt = clientSettings.updated_at ? new Date(clientSettings.updated_at) : new Date(0);
    if (serverSettings.updated_at > clientUpdatedAt) {
      // Server is newer, return current server settings as conflict
      return { settings: serverSettings, conflict: true };
    }
    
    // Client is newer or same, update server
    const settings = await this.updateSettings(userId, {
      language: clientSettings.language,
      locale: clientSettings.locale,
      first_day_of_week: clientSettings.first_day_of_week,
      statistics_email_frequency: clientSettings.statistics_email_frequency,
    });
    return { settings };
  }
}
