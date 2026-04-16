import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillTrialEndDate1749200000000 implements MigrationInterface {
  name = 'BackfillTrialEndDate1749200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Set trial_end_date to created_at + 2 months for any users that don't have one yet
    await queryRunner.query(`
      UPDATE users
      SET trial_end_date = created_at + INTERVAL '2 months'
      WHERE trial_end_date IS NULL
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Not reversible — we cannot know which rows were backfilled
  }
}
