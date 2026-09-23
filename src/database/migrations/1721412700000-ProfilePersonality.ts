import { MigrationInterface, QueryRunner } from "typeorm";

export class ProfilePersonality1721412700000 implements MigrationInterface {
  name = "ProfilePersonality1721412700000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "personality" jsonb NOT NULL DEFAULT '{}'::jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "personality"`);
  }
}
