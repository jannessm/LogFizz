import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorTimeLogStructure1732825000000 implements MigrationInterface {
    name = 'RefactorTimeLogStructure1732825000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Add new columns
        await queryRunner.query(`
            ALTER TABLE "time_logs" 
            ADD COLUMN IF NOT EXISTS "start_timestamp" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS "end_timestamp" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS "duration_minutes" integer
        `);

        // Step 2: Migrate existing data - pair start/stop events into single records
        // This query creates new time range entries from paired start/stop events
        await queryRunner.query(`
            WITH paired_logs AS (
                SELECT 
                    s.id as start_id,
                    s.user_id,
                    s.button_id,
                    s.timestamp as start_timestamp,
                    s.timezone,
                    s.apply_break_calculation,
                    s.notes as start_notes,
                    s.is_manual,
                    s.created_at,
                    s.deleted_at,
                    (
                        SELECT MIN(e.timestamp)
                        FROM "time_logs" e
                        WHERE e.user_id = s.user_id
                        AND e.button_id = s.button_id
                        AND e.type = 'stop'
                        AND e.timestamp > s.timestamp
                        AND e.deleted_at IS NULL
                    ) as end_timestamp
                FROM "time_logs" s
                WHERE s.type = 'start'
            )
            UPDATE "time_logs" t
            SET 
                start_timestamp = p.start_timestamp,
                end_timestamp = p.end_timestamp,
                duration_minutes = CASE 
                    WHEN p.end_timestamp IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (p.end_timestamp - p.start_timestamp)) / 60
                    ELSE NULL 
                END
            FROM paired_logs p
            WHERE t.id = p.start_id
        `);

        // Step 3: Delete the 'stop' type records since they're now merged
        await queryRunner.query(`
            DELETE FROM "time_logs" WHERE type = 'stop'
        `);

        // Step 4: For any remaining start events that weren't updated, 
        // set start_timestamp from timestamp
        await queryRunner.query(`
            UPDATE "time_logs" 
            SET start_timestamp = timestamp 
            WHERE start_timestamp IS NULL AND type = 'start'
        `);

        // Step 5: Make start_timestamp NOT NULL after data migration
        await queryRunner.query(`
            ALTER TABLE "time_logs" 
            ALTER COLUMN "start_timestamp" SET NOT NULL
        `);

        // Step 6: Drop old columns
        await queryRunner.query(`
            ALTER TABLE "time_logs" 
            DROP COLUMN IF EXISTS "type",
            DROP COLUMN IF EXISTS "timestamp"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Add back old columns
        await queryRunner.query(`
            ALTER TABLE "time_logs" 
            ADD COLUMN IF NOT EXISTS "type" character varying,
            ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP WITH TIME ZONE
        `);

        // Step 2: Restore data - create start events from start_timestamp
        await queryRunner.query(`
            UPDATE "time_logs" 
            SET type = 'start', 
                timestamp = start_timestamp
        `);

        // Step 3: Create stop events for entries that have end_timestamp
        await queryRunner.query(`
            INSERT INTO "time_logs" (
                "id", "user_id", "button_id", "type", "timestamp", 
                "timezone", "apply_break_calculation", "notes", "is_manual",
                "created_at", "updated_at", "deleted_at"
            )
            SELECT 
                uuid_generate_v4(),
                user_id,
                button_id,
                'stop',
                end_timestamp,
                timezone,
                apply_break_calculation,
                notes,
                is_manual,
                created_at,
                updated_at,
                deleted_at
            FROM "time_logs"
            WHERE end_timestamp IS NOT NULL
        `);

        // Step 4: Make timestamp NOT NULL
        await queryRunner.query(`
            ALTER TABLE "time_logs" 
            ALTER COLUMN "timestamp" SET NOT NULL,
            ALTER COLUMN "type" SET NOT NULL
        `);

        // Step 5: Drop new columns
        await queryRunner.query(`
            ALTER TABLE "time_logs" 
            DROP COLUMN IF EXISTS "start_timestamp",
            DROP COLUMN IF EXISTS "end_timestamp",
            DROP COLUMN IF EXISTS "duration_minutes"
        `);
    }
}
