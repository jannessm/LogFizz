import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHolidayLocalName1748200000000 implements MigrationInterface {
  name = 'AddHolidayLocalName1748200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "holidays"
        ADD COLUMN IF NOT EXISTS "localName" character varying NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "holidays"
        DROP COLUMN IF EXISTS "localName"
    `);
  }
}
