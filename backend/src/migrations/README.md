# Database Migrations

This directory contains TypeORM migrations for managing the database schema.

## How it works

- **Development/Test**: Uses `synchronize: true` - TypeORM automatically creates/updates tables
- **Production**: Uses migrations - Explicit schema changes for safety

## Migration Scripts

```bash
# Run pending migrations (production only)
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate a new migration from entity changes
npm run migration:generate -- src/migrations/MigrationName
```

## Automatic Migration Execution

In production mode (`NODE_ENV=production`), migrations run automatically on server startup via:
- `migrationsRun: true` in database configuration
- Explicit call in `startServer()` function

## Files

- `1699700000000-InitialSchema.ts` - Initial database schema with all tables
- `runner.ts` - Migration runner utility

## Adding New Migrations

1. Modify your entities
2. Generate migration: `npm run migration:generate -- src/migrations/YourMigrationName`
3. Review and adjust the generated migration
4. Commit the migration file
5. Deploy - migrations run automatically in production
