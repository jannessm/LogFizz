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
                "country" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
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
                "position" integer NOT NULL DEFAULT 0,
                "icon" character varying,
                "goal_time_minutes" integer,
                "goal_days" text,
                "auto_subtract_breaks" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_buttons_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_buttons_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        // Create time_logs table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "time_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "button_id" uuid NOT NULL,
                "start_time" TIMESTAMP NOT NULL,
                "end_time" TIMESTAMP,
                "duration" integer,
                "break_time_subtracted" integer NOT NULL DEFAULT 0,
                "notes" text,
                "is_manual" boolean NOT NULL DEFAULT false,
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

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_buttons_user_id" ON "buttons" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_user_id" ON "time_logs" ("user_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_button_id" ON "time_logs" ("button_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_time_logs_start_time" ON "time_logs" ("start_time")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_holidays_country_year" ON "holidays" ("country", "year")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order (respecting foreign key constraints)
        await queryRunner.query(`DROP TABLE IF EXISTS "time_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "buttons"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "holidays"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    }
}
