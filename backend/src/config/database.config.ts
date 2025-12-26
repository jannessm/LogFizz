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

// Patch TypeORM's column type normalization for better-sqlite3 BEFORE creating DataSource
// This allows timestamptz and uuid types to work with SQLite
const BetterSqlite3Driver = require('typeorm/driver/better-sqlite3/BetterSqlite3Driver').BetterSqlite3Driver;
const originalNormalizeType = BetterSqlite3Driver.prototype.normalizeType;

BetterSqlite3Driver.prototype.normalizeType = function(column: any) {
  // Convert PostgreSQL-specific types to SQLite equivalents
  if (column.type === 'timestamptz' || column.type === 'timestamp with time zone' || column.type === 'timestamp') {
    column.type = 'datetime';
  }
  if (column.type === 'uuid') {
    column.type = 'varchar';
  }
  return originalNormalizeType.call(this, column);
};

// Monkey-patch the Repository save method to manually handle @UpdateDateColumn for SQLite
const RepositoryPrototype = require('typeorm/repository/Repository').Repository.prototype;
const originalSave = RepositoryPrototype.save;

RepositoryPrototype.save = async function(entityOrEntities: any, options?: any) {
  const isArray = Array.isArray(entityOrEntities);
  const entities = isArray ? entityOrEntities : [entityOrEntities];
  
  // For each entity, if it has updated_at and is being updated, set it to now
  for (const entity of entities) {
    if (entity && typeof entity === 'object') {
      const metadata = this.metadata;
      const updateColumn = metadata.updateDateColumn;
      
      if (updateColumn && entity.id) {
        // This is an update operation - set updated_at to now
        entity[updateColumn.propertyName] = new Date();
      }
    }
  }
  
  return originalSave.call(this, entityOrEntities, options);
};

export const TestDataSource = new DataSource({
  type: 'better-sqlite3',
  database: ':memory:',
  synchronize: true,
  logging: false,
  dropSchema: true,
  entities: [User, Timer, TimeLog, Holiday, HolidayMetadata, Target, TargetSpec, Balance, State],
});
