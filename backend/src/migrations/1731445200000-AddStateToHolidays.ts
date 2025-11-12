import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStateToHolidays1731445200000 implements MigrationInterface {
    name = 'AddStateToHolidays1731445200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add state column to holidays table (nullable to support existing data)
        await queryRunner.query(`
            ALTER TABLE "holidays" 
            ADD COLUMN IF NOT EXISTS "state" character varying
        `);

        // Create composite index for country, state, and year for efficient queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_holidays_country_state_year" 
            ON "holidays" ("country", "state", "year")
        `);

        // Add state column to holiday_metadata table
        await queryRunner.query(`
            ALTER TABLE "holiday_metadata" 
            ADD COLUMN IF NOT EXISTS "state" character varying
        `);

        // Update existing unique constraints to include state
        // First drop old index if exists
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_holidays_country_year"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the new index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_holidays_country_state_year"
        `);

        // Remove state column from holidays
        await queryRunner.query(`
            ALTER TABLE "holidays" 
            DROP COLUMN IF EXISTS "state"
        `);

        // Remove state column from holiday_metadata
        await queryRunner.query(`
            ALTER TABLE "holiday_metadata" 
            DROP COLUMN IF EXISTS "state"
        `);

        // Recreate the old index
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_holidays_country_year" 
            ON "holidays" ("country", "year")
        `);
    }
}
