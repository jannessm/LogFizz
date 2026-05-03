import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNormalDaysToBalances1749300000000 implements MigrationInterface {
    name = 'AddNormalDaysToBalances1749300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "balances"
            ADD COLUMN IF NOT EXISTS "normal_days" integer NOT NULL DEFAULT 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "balances"
            DROP COLUMN IF EXISTS "normal_days"
        `);
    }
}
