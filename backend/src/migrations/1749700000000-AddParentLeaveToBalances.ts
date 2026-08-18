import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParentLeaveToBalances1749700000000 implements MigrationInterface {
    name = 'AddParentLeaveToBalances1749700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "balances"
            ADD COLUMN IF NOT EXISTS "parent_leave" integer NOT NULL DEFAULT 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "balances"
            DROP COLUMN IF EXISTS "parent_leave"
        `);
    }
}
