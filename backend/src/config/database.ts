import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Button } from '../entities/Button';
import { TimeLog } from '../entities/TimeLog';
import { Holiday } from '../entities/Holiday';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'clock_user',
  password: process.env.DB_PASSWORD || 'clock_password',
  database: isTest ? 'clock_test_db' : (process.env.DB_DATABASE || 'clock_db'),
  synchronize: true, // Auto-create tables in dev and test
  logging: false,
  entities: [User, Button, TimeLog, Holiday],
  subscribers: [],
  migrations: [],
  dropSchema: isTest, // Drop and recreate schema for tests
});
