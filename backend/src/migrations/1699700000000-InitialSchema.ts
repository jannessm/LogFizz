import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1699700000000 implements MigrationInterface {
    name = 'InitialSchema1699700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Create users table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "password_hash" character varying NOT NULL,
                "name" character varying NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "email_verification_token" character varying,
                "email_verification_expires_at" TIMESTAMP WITH TIME ZONE,
                "email_verified_at" TIMESTAMP WITH TIME ZONE,
                "reset_token" character varying,
                "reset_token_expires_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
            )
        `);

        // Create states table (needed before daily_targets due to FK constraint)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "states" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "country" character varying NOT NULL,
                "state" character varying NOT NULL,
                "code" character varying NOT NULL,
                CONSTRAINT "PK_states_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_states_code" UNIQUE ("code")
            )
        `);

        // Insert German states
        await queryRunner.query(`
            INSERT INTO "states" ("country", "state", "code") VALUES
            ('Germany', 'Baden-Württemberg', 'DE-BW'),
            ('Germany', 'Bayern', 'DE-BY'),
            ('Germany', 'Berlin', 'DE-BE'),
            ('Germany', 'Brandenburg', 'DE-BB'),
            ('Germany', 'Bremen', 'DE-HB'),
            ('Germany', 'Hamburg', 'DE-HH'),
            ('Germany', 'Hessen', 'DE-HE'),
            ('Germany', 'Mecklenburg-Vorpommern', 'DE-MV'),
            ('Germany', 'Niedersachsen', 'DE-NI'),
            ('Germany', 'Nordrhein-Westfalen', 'DE-NW'),
            ('Germany', 'Rheinland-Pfalz', 'DE-RP'),
            ('Germany', 'Saarland', 'DE-SL'),
            ('Germany', 'Sachsen', 'DE-SN'),
            ('Germany', 'Sachsen-Anhalt', 'DE-ST'),
            ('Germany', 'Schleswig-Holstein', 'DE-SH'),
            ('Germany', 'Thüringen', 'DE-TH')
            ON CONFLICT (code) DO NOTHING
        `);

        // Create daily_targets table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "daily_targets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "duration_minutes" text NOT NULL,
                "weekdays" text NOT NULL,
                "state_code" character varying,
                "starting_from" TIMESTAMP WITH TIME ZONE,
                "ending_at" TIMESTAMP WITH TIME ZONE,
                "exclude_holidays" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_daily_targets_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_daily_targets_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_daily_targets_state_code" FOREIGN KEY ("state_code")
                    REFERENCES "states"("code") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);

        // Create buttons table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "buttons" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "emoji" character varying,
                "color" character varying,
                "target_id" uuid,
                "auto_subtract_breaks" boolean NOT NULL DEFAULT false,
                "archived" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_buttons_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_buttons_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_buttons_target_id" FOREIGN KEY ("target_id") 
                    REFERENCES "daily_targets"("id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);

        // Create time_logs table with start/end timestamp structure
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "time_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "button_id" uuid NOT NULL,
                "start_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
                "end_timestamp" TIMESTAMP WITH TIME ZONE,
                "duration_minutes" integer,
                "timezone" character varying NOT NULL,
                "apply_break_calculation" boolean NOT NULL DEFAULT false,
                "notes" text,
                "is_manual" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_time_logs_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_time_logs_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_time_logs_button_id" FOREIGN KEY ("button_id") 
                    REFERENCES "buttons"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create holidays table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "holidays" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "country" character varying NOT NULL,
                "date" date NOT NULL,
                "name" character varying NOT NULL,
                "year" integer NOT NULL,
                CONSTRAINT "PK_holidays_id" PRIMARY KEY ("id")
            )
        `);

        // Create holiday_metadata table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "holiday_metadata" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "country" character varying NOT NULL,
                "year" integer NOT NULL,
                "last_updated" TIMESTAMP NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_holiday_metadata_id" PRIMARY KEY ("id")
            )
        `);

        // Create monthly_balances table
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

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_daily_targets_user_id" ON "daily_targets" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_daily_targets_state_code" ON "daily_targets" ("state_code")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_daily_targets_deleted_at" ON "daily_targets" ("deleted_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_daily_targets_updated_at" ON "daily_targets" ("updated_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_buttons_user_id" ON "buttons" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_buttons_target_id" ON "buttons" ("target_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_user_id" ON "time_logs" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_button_id" ON "time_logs" ("button_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_start_timestamp" ON "time_logs" ("start_timestamp")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_holidays_country_year" ON "holidays" ("country", "year")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_deleted_at" ON "users" ("deleted_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_buttons_deleted_at" ON "buttons" ("deleted_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_deleted_at" ON "time_logs" ("deleted_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_buttons_updated_at" ON "buttons" ("updated_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_updated_at" ON "time_logs" ("updated_at")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_monthly_balances_user_target_year_month" ON "monthly_balances" ("user_id", "target_id", "year", "month")`);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order (respecting foreign key constraints)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_monthly_balances_user_target_year_month"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "monthly_balances"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "states"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "time_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "buttons"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "daily_targets"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "holiday_metadata"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "holidays"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    }
}
