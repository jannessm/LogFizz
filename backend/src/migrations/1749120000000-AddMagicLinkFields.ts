import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMagicLinkFields1749120000000 implements MigrationInterface {
  name = 'AddMagicLinkFields1749120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add magic link token fields for passwordless login
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "magic_link_token" varchar,
        ADD COLUMN IF NOT EXISTS "magic_link_token_expires_at" timestamptz
    `);

    // Add pending email change fields for email verification on change
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "pending_email" varchar,
        ADD COLUMN IF NOT EXISTS "email_change_token" varchar,
        ADD COLUMN IF NOT EXISTS "email_change_token_expires_at" timestamptz
    `);

    // Make password_hash nullable when migrating from schemas that still have it.
    if (await queryRunner.hasColumn('users', 'password_hash')) {
      await queryRunner.query(`
        ALTER TABLE "users"
          ALTER COLUMN "password_hash" DROP NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "magic_link_token",
        DROP COLUMN IF EXISTS "magic_link_token_expires_at",
        DROP COLUMN IF EXISTS "pending_email",
        DROP COLUMN IF EXISTS "email_change_token",
        DROP COLUMN IF EXISTS "email_change_token_expires_at"
    `);

    // Restore NOT NULL on password_hash only for schemas that still keep it.
    if (await queryRunner.hasColumn('users', 'password_hash')) {
      await queryRunner.query(`
        UPDATE "users" SET "password_hash" = '' WHERE "password_hash" IS NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "users"
          ALTER COLUMN "password_hash" SET NOT NULL
      `);
    }
  }
}
