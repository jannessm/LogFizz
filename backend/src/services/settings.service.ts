import { AppDataSource } from '../config/database.js';
import { Settings } from '../entities/Settings.js';

export class SettingsService {
  private settingsRepository = AppDataSource.getRepository(Settings);

  /**
   * Get a setting value by key
   */
  async getSetting(key: string): Promise<string | null> {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    return setting?.value || null;
  }

  /**
   * Set a setting value
   */
  async setSetting(key: string, value: string): Promise<void> {
    let setting = await this.settingsRepository.findOne({ where: { key } });
    
    if (setting) {
      setting.value = value;
    } else {
      setting = this.settingsRepository.create({ key, value });
    }
    
    await this.settingsRepository.save(setting);
  }

  /**
   * Check if paywall is enabled
   */
  async isPaywallEnabled(): Promise<boolean> {
    const value = await this.getSetting('paywall_enabled');
    return value === 'true';
  }

  /**
   * Enable or disable paywall
   */
  async setPaywallEnabled(enabled: boolean): Promise<void> {
    await this.setSetting('paywall_enabled', enabled ? 'true' : 'false');
  }
}
