import { MigrationInterface, QueryRunner } from "typeorm";

export class TrackMatchPassSide1721412500000 implements MigrationInterface {
  name = "TrackMatchPassSide1721412500000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "passed_by_a" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "passed_by_b" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`UPDATE "matches" SET "passed_by_a" = true, "passed_by_b" = true WHERE "status" = 'passed'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "passed_by_b"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN IF EXISTS "passed_by_a"`);
  }
}
