import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSetupCompleted1749034000000 implements MigrationInterface {
  name = 'AddSetupCompleted1749034000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
        ADD COLUMN IF NOT EXISTS "setup_completed" boolean NOT NULL DEFAULT false
    `);

    // Mark existing users who have customized their settings as setup completed
    // (their updated_at differs from created_at by more than 1 second)
    await queryRunner.query(`
      UPDATE "user_settings"
        SET "setup_completed" = true
        WHERE "updated_at" > "created_at" + interval '1 second'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
        DROP COLUMN IF EXISTS "setup_completed"
    `);
  }
}
