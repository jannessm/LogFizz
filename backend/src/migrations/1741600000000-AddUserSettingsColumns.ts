import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSettingsColumns1741600000000 implements MigrationInterface {
  name = 'AddUserSettingsColumns1741600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
        ADD COLUMN IF NOT EXISTS "first_day_of_week" character varying NOT NULL DEFAULT 'sunday',
        ADD COLUMN IF NOT EXISTS "statistics_email_frequency" character varying NOT NULL DEFAULT 'none'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
        DROP COLUMN IF EXISTS "first_day_of_week",
        DROP COLUMN IF EXISTS "statistics_email_frequency"
    `);
  }
}
