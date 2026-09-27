import { MigrationInterface, QueryRunner } from "typeorm";

export class ConsentRecords1721412900000 implements MigrationInterface {
  name = "ConsentRecords1721412900000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sensitive_data_consent_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "biometric_consent_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_policy_version" varchar(20)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "consent_records" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "type" varchar(30) NOT NULL,
      "granted" boolean NOT NULL,
      "policy_version" varchar(20) NOT NULL,
      "ip_address" varchar(64),
      "user_agent" varchar(300),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_consent_records_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_consent_records_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_consent_records_user_id" ON "consent_records" ("user_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "consent_records"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_policy_version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "biometric_consent_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "sensitive_data_consent_at"`);
  }
}
