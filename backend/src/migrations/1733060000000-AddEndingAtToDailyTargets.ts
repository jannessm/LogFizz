import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEndingAtToDailyTargets1733060000000 implements MigrationInterface {
    name = 'AddEndingAtToDailyTargets1733060000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "daily_targets"
            ADD COLUMN IF NOT EXISTS "ending_at" TIMESTAMP WITH TIME ZONE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "daily_targets"
            DROP COLUMN IF EXISTS "ending_at"
        `);
    }
}
