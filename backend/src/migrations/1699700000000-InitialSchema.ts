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
                "subscription_status" character varying DEFAULT 'trial',
                "subscription_end_date" TIMESTAMP WITH TIME ZONE,
                "trial_end_date" TIMESTAMP WITH TIME ZONE,
                "stripe_customer_id" character varying,
                "stripe_subscription_id" character varying,
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
            )
        `);

        // Create states table (needed before targets due to FK constraint)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "states" (
                "code" character varying NOT NULL,
                "country" character varying NOT NULL,
                "state" character varying NOT NULL,
                CONSTRAINT "PK_states_code" PRIMARY KEY ("code")
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

        // Create targets table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "targets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "target_spec_ids" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_targets_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_targets_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create target_specs table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "target_specs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "target_id" uuid NOT NULL,
                "duration_minutes" text NOT NULL,
                "exclude_holidays" boolean NOT NULL DEFAULT false,
                "state_code" character varying,
                "starting_from" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "ending_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_target_specs_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_target_specs_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_target_specs_target_id" FOREIGN KEY ("target_id") 
                    REFERENCES "targets"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_target_specs_state_code" FOREIGN KEY ("state_code")
                    REFERENCES "states"("code") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);

        // Create timers table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "timers" (
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
                CONSTRAINT "PK_timers_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_timers_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_timers_target_id" FOREIGN KEY ("target_id") 
                    REFERENCES "targets"("id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);

        // Create time_logs table with start/end timestamp structure
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "time_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "timer_id" uuid NOT NULL,
                "type" character varying NOT NULL DEFAULT 'normal',
                "whole_day" boolean NOT NULL DEFAULT false,
                "start_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
                "end_timestamp" TIMESTAMP WITH TIME ZONE,
                "duration_minutes" integer,
                "timezone" character varying NOT NULL,
                "apply_break_calculation" boolean NOT NULL DEFAULT false,
                "notes" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_time_logs_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_time_logs_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_time_logs_timer_id" FOREIGN KEY ("timer_id") 
                    REFERENCES "timers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create holidays table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "holidays" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "country" character varying NOT NULL,
                "global" boolean NOT NULL DEFAULT false,
                "counties" varchar[] NOT NULL,
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
                "state" character varying,
                "year" integer NOT NULL,
                "last_updated" TIMESTAMP NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_holiday_metadata_id" PRIMARY KEY ("id")
            )
        `);

        // Create balances table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "balances" (
                "id" character varying NOT NULL,
                "user_id" uuid NOT NULL,
                "target_id" uuid NOT NULL,

                "date" character varying NOT NULL,
                "due_minutes" integer NOT NULL DEFAULT 0,
                "worked_minutes" integer NOT NULL DEFAULT 0,
                "cumulative_minutes" integer NOT NULL DEFAULT 0,

                "sick_days" integer NOT NULL DEFAULT 0,
                "holidays" integer NOT NULL DEFAULT 0,
                "business_trip" integer NOT NULL DEFAULT 0,
                "child_sick" integer NOT NULL DEFAULT 0,
                "worked_days" integer NOT NULL DEFAULT 0,
                "homeoffice" integer NOT NULL DEFAULT 0,
                
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                
                CONSTRAINT "PK_balances" PRIMARY KEY ("id"),
                CONSTRAINT "FK_balances_user" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_balances_target" FOREIGN KEY ("target_id") 
                    REFERENCES "targets"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create settings table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "settings" (
                "key" character varying NOT NULL,
                "value" character varying NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_settings_key" PRIMARY KEY ("key")
            )
        `);

        // Insert default settings
        await queryRunner.query(`
            INSERT INTO "settings" ("key", "value") VALUES
            ('paywall_enabled', 'false')
            ON CONFLICT (key) DO NOTHING
        `);

        // Create user_settings table for user-specific settings
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_settings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "language" character varying NOT NULL DEFAULT 'en',
                "locale" character varying NOT NULL DEFAULT 'en-US',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_settings_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_settings_user_id" UNIQUE ("user_id"),
                CONSTRAINT "FK_user_settings_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_targets_user_id" ON "targets" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_targets_deleted_at" ON "targets" ("deleted_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_targets_updated_at" ON "targets" ("updated_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_target_specs_user_id" ON "target_specs" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_target_specs_target_id" ON "target_specs" ("target_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_target_specs_state_code" ON "target_specs" ("state_code")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_target_specs_updated_at" ON "target_specs" ("updated_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_timers_user_id" ON "timers" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_timers_target_id" ON "timers" ("target_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_user_id" ON "time_logs" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_timer_id" ON "time_logs" ("timer_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_start_timestamp" ON "time_logs" ("start_timestamp")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_holidays_country_year" ON "holidays" ("country", "year")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_deleted_at" ON "users" ("deleted_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_timers_deleted_at" ON "timers" ("deleted_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_deleted_at" ON "time_logs" ("deleted_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_timers_updated_at" ON "timers" ("updated_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_updated_at" ON "time_logs" ("updated_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_settings_updated_at" ON "user_settings" ("updated_at")`);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order (respecting foreign key constraints)
        await queryRunner.query(`DROP TABLE IF EXISTS "balances"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_settings"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "settings"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "time_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "timers"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "target_specs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "targets"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "holiday_metadata"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "holidays"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "states"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    }
}
