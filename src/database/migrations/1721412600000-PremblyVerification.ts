import { MigrationInterface, QueryRunner } from "typeorm";

export class PremblyVerification1721412600000 implements MigrationInterface {
  name = "PremblyVerification1721412600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "verification_submissions" ALTER COLUMN "document_key" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ADD COLUMN IF NOT EXISTS "document_country" varchar(4)`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ADD COLUMN IF NOT EXISTS "document_number_last4" varchar(8)`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ADD COLUMN IF NOT EXISTS "document_number_hash" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ADD COLUMN IF NOT EXISTS "provider" varchar(40) NOT NULL DEFAULT 'manual'`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ADD COLUMN IF NOT EXISTS "provider_reference" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ADD COLUMN IF NOT EXISTS "provider_payload" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ADD COLUMN IF NOT EXISTS "liveness_passed" boolean`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ADD COLUMN IF NOT EXISTS "face_match_passed" boolean`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_verification_submissions_document_number_hash" ON "verification_submissions" ("document_number_hash")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_verification_submissions_document_number_hash"`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" DROP COLUMN IF EXISTS "face_match_passed"`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" DROP COLUMN IF EXISTS "liveness_passed"`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" DROP COLUMN IF EXISTS "provider_payload"`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" DROP COLUMN IF EXISTS "provider_reference"`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" DROP COLUMN IF EXISTS "provider"`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" DROP COLUMN IF EXISTS "document_number_hash"`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" DROP COLUMN IF EXISTS "document_number_last4"`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" DROP COLUMN IF EXISTS "document_country"`);
    await queryRunner.query(`UPDATE "verification_submissions" SET "document_key" = '' WHERE "document_key" IS NULL`);
    await queryRunner.query(`ALTER TABLE "verification_submissions" ALTER COLUMN "document_key" SET NOT NULL`);
  }
}
