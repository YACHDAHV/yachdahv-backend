import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistInvitations1721412300000 implements MigrationInterface {
  name = "WaitlistInvitations1721412300000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "waitlist_invites_status_enum" AS ENUM ('pending','redeemed','revoked')`);
    await queryRunner.query(`CREATE TABLE "churches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(120) NOT NULL UNIQUE,
      "active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`INSERT INTO "churches" ("name") VALUES
      ('Harvesters International Christian Center'),
      ('Streams of Joy'),
      ('House on the Rock'),
      ('Daystar'),
      ('Elevation Church')`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN "church_id" uuid REFERENCES "churches"("id") ON DELETE SET NULL`);
    await queryRunner.query(`UPDATE "profiles" p SET "church_id" = c."id" FROM "churches" c WHERE LOWER(p."church") = LOWER(c."name")`);
    await queryRunner.query(`CREATE TABLE "waitlist_invites" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" varchar(160) NOT NULL,
      "church_id" uuid REFERENCES "churches"("id") ON DELETE SET NULL,
      "code_hash" varchar(64) NOT NULL UNIQUE,
      "code_hint" varchar(20) NOT NULL,
      "status" waitlist_invites_status_enum NOT NULL DEFAULT 'pending',
      "expires_at" timestamptz NOT NULL,
      "sent_at" timestamptz,
      "redeemed_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "redeemed_at" timestamptz,
      "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX "waitlist_invites_email_idx" ON "waitlist_invites" (LOWER("email"))`);
    await queryRunner.query(`CREATE INDEX "waitlist_invites_status_idx" ON "waitlist_invites" ("status", "expires_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "waitlist_invites"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "church_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "churches"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "waitlist_invites_status_enum"`);
  }
}
