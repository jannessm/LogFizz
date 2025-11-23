import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMonthlyBalanceAndExcludeHolidays1732400000000 implements MigrationInterface {
    name = 'AddMonthlyBalanceAndExcludeHolidays1732400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add exclude_holidays column to daily_targets table if it doesn't exist
        await queryRunner.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='daily_targets' AND column_name='exclude_holidays'
                ) THEN
                    ALTER TABLE "daily_targets" 
                    ADD COLUMN "exclude_holidays" boolean NOT NULL DEFAULT false;
                END IF;
            END $$;
        `);

        // Create monthly_balances table if it doesn't exist
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "monthly_balances" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "target_id" uuid NOT NULL,
                "year" integer NOT NULL,
                "month" integer NOT NULL,
                "worked_minutes" integer NOT NULL,
                "due_minutes" integer NOT NULL,
                "balance_minutes" integer NOT NULL,
                "exclude_holidays" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_monthly_balances" PRIMARY KEY ("id"),
                CONSTRAINT "FK_monthly_balances_user" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_monthly_balances_target" FOREIGN KEY ("target_id") 
                    REFERENCES "daily_targets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create unique index on user_id, target_id, year, month if it doesn't exist
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_monthly_balances_user_target_year_month" 
            ON "monthly_balances" ("user_id", "target_id", "year", "month")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop monthly_balances table and its indexes
        await queryRunner.query(`DROP INDEX "IDX_monthly_balances_user_target_year_month"`);
        await queryRunner.query(`DROP TABLE "monthly_balances"`);

        // Remove exclude_holidays column from daily_targets
        await queryRunner.query(`
            ALTER TABLE "daily_targets" 
            DROP COLUMN "exclude_holidays"
        `);
    }
}
