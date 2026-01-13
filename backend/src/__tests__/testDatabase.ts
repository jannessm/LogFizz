import { TestDataSource } from '../config/database.config.js';
import { State } from '../entities/State.js';

/**
 * Initialize test database with fresh schema
 * Uses in-memory SQLite database for tests (no PostgreSQL required)
 */
export async function initializeTestDatabase() {
  if (TestDataSource.isInitialized) {
    await TestDataSource.destroy();
  }
  
  await TestDataSource.initialize();
  
  // Seed German states (required for state-related tests)
  await seedGermanStates();
  
  console.log('✓ Test database initialized (in-memory SQLite)');
}

/**
 * Seed German states into the database
 */
async function seedGermanStates() {
  const stateRepository = TestDataSource.getRepository(State);
  
  const states = [
    { country: 'Germany', state: 'Baden-Württemberg', code: 'DE-BW' },
    { country: 'Germany', state: 'Bayern', code: 'DE-BY' },
    { country: 'Germany', state: 'Berlin', code: 'DE-BE' },
    { country: 'Germany', state: 'Brandenburg', code: 'DE-BB' },
    { country: 'Germany', state: 'Bremen', code: 'DE-HB' },
    { country: 'Germany', state: 'Hamburg', code: 'DE-HH' },
    { country: 'Germany', state: 'Hessen', code: 'DE-HE' },
    { country: 'Germany', state: 'Mecklenburg-Vorpommern', code: 'DE-MV' },
    { country: 'Germany', state: 'Niedersachsen', code: 'DE-NI' },
    { country: 'Germany', state: 'Nordrhein-Westfalen', code: 'DE-NW' },
    { country: 'Germany', state: 'Rheinland-Pfalz', code: 'DE-RP' },
    { country: 'Germany', state: 'Saarland', code: 'DE-SL' },
    { country: 'Germany', state: 'Sachsen', code: 'DE-SN' },
    { country: 'Germany', state: 'Sachsen-Anhalt', code: 'DE-ST' },
    { country: 'Germany', state: 'Schleswig-Holstein', code: 'DE-SH' },
    { country: 'Germany', state: 'Thüringen', code: 'DE-TH' },
  ];
  
  for (const stateData of states) {
    const existing = await stateRepository.findOne({ where: { code: stateData.code } });
    if (!existing) {
      await stateRepository.save(stateData);
    }
  }
  
  console.log('✓ German states seeded');
}

