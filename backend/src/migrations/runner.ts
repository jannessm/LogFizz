import 'reflect-metadata';
import { AppDataSource } from '../config/database.js';

export async function runMigrations() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    console.log('Skipping migrations in development mode (using synchronize)');
    return;
  }

  try {
    console.log('Running database migrations...');
    await AppDataSource.runMigrations();
    console.log('✓ Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

// CLI handler for migration commands
async function main() {
  const command = process.argv[2];

  try {
    await AppDataSource.initialize();
    console.log('✓ Database connection initialized');

    switch (command) {
      case 'generate': {
        const migrationName = process.argv[3];
        if (!migrationName) {
          console.error('Error: Migration name is required');
          console.log('Usage: npm run migration:generate <MigrationName>');
          process.exit(1);
        }
        
        console.log(`Generating migration: ${migrationName}...`);
        
        // TypeORM's migration:generate functionality
        const sqlInMemory = await AppDataSource.driver.createSchemaBuilder().log();
        
        if (sqlInMemory.upQueries.length === 0) {
          console.log('✓ No changes detected in schema. No migration generated.');
          process.exit(0);
        }
        
        console.log('\nSchema changes detected:');
        console.log('Up queries:', sqlInMemory.upQueries.length);
        console.log('Down queries:', sqlInMemory.downQueries.length);
        
        const timestamp = Date.now();
        const fileName = `${timestamp}-${migrationName}.ts`;
        const filePath = `src/migrations/${fileName}`;
        
        const upQueries = sqlInMemory.upQueries.map(q => `        await queryRunner.query(\`${q.query.replace(/`/g, '\\`')}\`);`).join('\n');
        const downQueries = sqlInMemory.downQueries.map(q => `        await queryRunner.query(\`${q.query.replace(/`/g, '\\`')}\`);`).join('\n');
        
        const fileContent = `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${migrationName}${timestamp} implements MigrationInterface {
    name = '${migrationName}${timestamp}'

    public async up(queryRunner: QueryRunner): Promise<void> {
${upQueries}
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
${downQueries}
    }
}
`;
        
        const fs = await import('fs/promises');
        await fs.writeFile(filePath, fileContent);
        
        console.log(`✓ Migration generated: ${filePath}`);
        break;
      }

      case 'run': {
        console.log('Running pending migrations...');
        const migrations = await AppDataSource.runMigrations();
        
        if (migrations.length === 0) {
          console.log('✓ No pending migrations to run');
        } else {
          console.log(`✓ Successfully ran ${migrations.length} migration(s):`);
          migrations.forEach(m => console.log(`  - ${m.name}`));
        }
        break;
      }

      case 'revert': {
        console.log('Reverting last migration...');
        await AppDataSource.undoLastMigration();
        console.log('✓ Migration reverted successfully');
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Available commands: generate, run, revert');
        process.exit(1);
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
