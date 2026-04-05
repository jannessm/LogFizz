import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Timer } from '../entities/Timer.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { HolidayMetadata } from '../entities/HolidayMetadata.js';
import { Target } from '../entities/Target.js';
import { TargetSpec } from '../entities/TargetSpec.js';
import { Balance } from '../entities/Balance.js';
import { State } from '../entities/State.js';
import { Settings } from '../entities/Settings.js';
import { UserSettings } from '../entities/UserSettings.js';
import { InitialSchema1699700000000 } from '../migrations/1699700000000-InitialSchema.js';
import { AddUserSettingsColumns1741600000000 } from '../migrations/1741600000000-AddUserSettingsColumns.js';
import { AddHolidayLocalName1748200000000 } from '../migrations/1748200000000-AddHolidayLocalName.js';
import { AddSetupCompleted1749034000000 } from '../migrations/1749034000000-AddSetupCompleted.js';
import { AddMagicLinkFields1749120000000 } from '../migrations/1749120000000-AddMagicLinkFields.js';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const isProduction = process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'clock_user',
  password: process.env.DB_PASSWORD || 'clock_password',
  database: isTest ? 'clock_test_db' : (process.env.DB_DATABASE || 'clock_db'),
  synchronize: !isProduction, // Auto-create tables in dev and test only
  logging: !isProduction && !isTest,
  entities: [User, Timer, TimeLog, Holiday, HolidayMetadata, Target, TargetSpec, Balance, State, Settings, UserSettings],
  subscribers: [],
  migrations: [InitialSchema1699700000000, AddUserSettingsColumns1741600000000, AddHolidayLocalName1748200000000, AddSetupCompleted1749034000000, AddMagicLinkFields1749120000000],
  migrationsRun: isProduction, // Auto-run migrations in production
  // Ensure PostgreSQL uses UTC for all timestamps
  extra: {
    timezone: 'UTC',
  },
});
