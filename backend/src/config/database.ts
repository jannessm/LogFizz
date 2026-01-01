import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Button } from '../entities/Button.js';
import { TimeLog } from '../entities/TimeLog.js';
import { Holiday } from '../entities/Holiday.js';
import { HolidayMetadata } from '../entities/HolidayMetadata.js';
import { DailyTarget } from '../entities/DailyTarget.js';
import { MonthlyBalance } from '../entities/MonthlyBalance.js';
import { State } from '../entities/State.js';
import { Settings } from '../entities/Settings.js';
import { InitialSchema1699700000000 } from '../migrations/1699700000000-InitialSchema.js';

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
  entities: [User, Button, TimeLog, Holiday, HolidayMetadata, DailyTarget, MonthlyBalance, State, Settings],
  subscribers: [],
  migrations: [InitialSchema1699700000000],
  migrationsRun: isProduction, // Auto-run migrations in production
  // Ensure PostgreSQL uses UTC for all timestamps
  extra: {
    timezone: 'UTC',
  },
});
