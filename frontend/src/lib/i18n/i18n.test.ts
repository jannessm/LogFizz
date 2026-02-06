import { describe, it, expect } from 'vitest';
import enTranslations from './en.json';
import deTranslations from './de.json';

/**
 * Recursively get all keys from a nested object
 */
function getAllKeys(obj: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = [];
  
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

describe('i18n translations', () => {
  const enKeys = getAllKeys(enTranslations);
  const deKeys = getAllKeys(deTranslations);

  it('should have the same keys in English and German translations', () => {
    const missingInDe = enKeys.filter(key => !deKeys.includes(key));
    const missingInEn = deKeys.filter(key => !enKeys.includes(key));
    
    if (missingInDe.length > 0) {
      console.error('Keys missing in German translation:', missingInDe);
    }
    if (missingInEn.length > 0) {
      console.error('Keys missing in English translation:', missingInEn);
    }
    
    expect(missingInDe).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('should not have empty translation values in English', () => {
    const emptyKeys = enKeys.filter(key => {
      const value = getNestedValue(enTranslations, key);
      return typeof value === 'string' && value.trim() === '';
    });
    
    if (emptyKeys.length > 0) {
      console.error('Empty values in English translation:', emptyKeys);
    }
    
    expect(emptyKeys).toEqual([]);
  });

  it('should not have empty translation values in German', () => {
    const emptyKeys = deKeys.filter(key => {
      const value = getNestedValue(deTranslations, key);
      return typeof value === 'string' && value.trim() === '';
    });
    
    if (emptyKeys.length > 0) {
      console.error('Empty values in German translation:', emptyKeys);
    }
    
    expect(emptyKeys).toEqual([]);
  });

  it('should have all required top-level sections', () => {
    const requiredSections = [
      'common',
      'auth',
      'verifyEmail',
      'settings',
      'dashboard',
      'timer',
      'timelog',
      'history',
      'table',
      'target',
      'nav',
      'forgotPassword',
      'resetPassword',
      'import',
      'export',
    ];
    
    for (const section of requiredSections) {
      expect(enTranslations).toHaveProperty(section);
      expect(deTranslations).toHaveProperty(section);
    }
  });

  it('should have all translations be strings (not objects at leaf level)', () => {
    for (const key of enKeys) {
      const enValue = getNestedValue(enTranslations, key);
      const deValue = getNestedValue(deTranslations, key);
      
      expect(typeof enValue).toBe('string');
      expect(typeof deValue).toBe('string');
    }
  });

  it('should have consistent placeholder usage between languages', () => {
    // Check that placeholders like {name} exist in both translations
    const placeholderRegex = /\{[a-zA-Z_]+\}/g;
    
    for (const key of enKeys) {
      const enValue = getNestedValue(enTranslations, key);
      const deValue = getNestedValue(deTranslations, key);
      
      if (typeof enValue !== 'string' || typeof deValue !== 'string') continue;
      
      const enPlaceholders = enValue.match(placeholderRegex) || [];
      const dePlaceholders = deValue.match(placeholderRegex) || [];
      
      // Sort to compare regardless of order
      const enSorted = [...enPlaceholders].sort();
      const deSorted = [...dePlaceholders].sort();
      
      if (enSorted.join(',') !== deSorted.join(',')) {
        console.error(`Placeholder mismatch for key "${key}":`, {
          en: enPlaceholders,
          de: dePlaceholders,
        });
      }
      
      expect(enSorted).toEqual(deSorted);
    }
  });
});
