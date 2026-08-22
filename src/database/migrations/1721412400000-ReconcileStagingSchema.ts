import { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileStagingSchema1721412400000 implements MigrationInterface {
  name = "ReconcileStagingSchema1721412400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_role" varchar(40)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_preferences" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`UPDATE "users" SET "admin_role" = 'Super Admin', "permissions" = ARRAY['view_users','manage_users','review_verification','resolve_reports','manage_admins','manage_system'] WHERE "role" = 'super_admin' AND "admin_role" IS NULL AND "permissions" = '{}'`);
    await queryRunner.query(`UPDATE "users" SET "admin_role" = 'Support', "permissions" = ARRAY['view_users'] WHERE "role" = 'admin' AND "admin_role" IS NULL AND "permissions" = '{}'`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "platform_settings" (
      "key" varchar(80) PRIMARY KEY,
      "value" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`INSERT INTO "platform_settings" ("key", "value") VALUES
      ('role_permissions', '{"Super Admin":["view_users","manage_users","review_verification","resolve_reports","manage_admins","manage_system"],"Trust & Safety":["view_users","review_verification","resolve_reports"],"Support":["view_users"]}'::jsonb),
      ('system_controls', '{"matching":true,"maintenance":false,"weeklyLimit":5}'::jsonb)
      ON CONFLICT ("key") DO NOTHING`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "relationship_tool_states" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "match_id" uuid NOT NULL UNIQUE REFERENCES "matches"("id") ON DELETE CASCADE,
      "devotional_day" smallint NOT NULL DEFAULT 0,
      "reflections" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "discussed_topics" text[] NOT NULL DEFAULT '{}',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "waitlist_invites_status_enum" AS ENUM ('pending','redeemed','revoked');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "churches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(120) NOT NULL UNIQUE,
      "active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`INSERT INTO "churches" ("name") SELECT * FROM (VALUES
      ('Harvesters International Christian Center'),
      ('Streams of Joy'),
      ('House on the Rock'),
      ('Daystar'),
      ('Elevation Church')
    ) AS seed(name) WHERE NOT EXISTS (SELECT 1 FROM "churches")`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "church_id" uuid REFERENCES "churches"("id") ON DELETE SET NULL`);
    await queryRunner.query(`UPDATE "profiles" p SET "church_id" = c."id" FROM "churches" c WHERE p."church_id" IS NULL AND LOWER(p."church") = LOWER(c."name")`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "waitlist_invites" (
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
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "waitlist_invites_email_idx" ON "waitlist_invites" (LOWER("email"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "waitlist_invites_status_idx" ON "waitlist_invites" ("status", "expires_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "waitlist_invites_status_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "waitlist_invites_email_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "waitlist_invites"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "church_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "churches"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "waitlist_invites_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "relationship_tool_states"`);
    await queryRunner.query(`DELETE FROM "platform_settings" WHERE "key" IN ('role_permissions','system_controls')`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "admin_preferences"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "permissions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "admin_role"`);
  }
}
