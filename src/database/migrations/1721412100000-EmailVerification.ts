import { MigrationInterface, QueryRunner } from "typeorm";

export class EmailVerification1721412100000 implements MigrationInterface {
  name = "EmailVerification1721412100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "email_verified" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`UPDATE "users" SET "email_verified" = true`);
    await queryRunner.query(`CREATE TABLE "email_codes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar(160) NOT NULL,
      "code_hash" varchar(120) NOT NULL, "attempts" smallint NOT NULL DEFAULT 0,
      "expires_at" timestamptz NOT NULL, "used_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX "email_codes_email_idx" ON "email_codes" ("email")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_codes"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified"`);
  }
}
