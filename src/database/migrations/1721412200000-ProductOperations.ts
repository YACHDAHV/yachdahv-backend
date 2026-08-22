import { MigrationInterface, QueryRunner } from "typeorm";

export class ProductOperations1721412200000 implements MigrationInterface {
  name = "ProductOperations1721412200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "admin_role" varchar(40)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "permissions" text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "admin_preferences" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`UPDATE "users" SET "admin_role" = 'Super Admin', "permissions" = ARRAY['view_users','manage_users','review_verification','resolve_reports','manage_admins','manage_system'] WHERE "role" = 'super_admin'`);
    await queryRunner.query(`UPDATE "users" SET "admin_role" = 'Support', "permissions" = ARRAY['view_users'] WHERE "role" = 'admin'`);

    await queryRunner.query(`CREATE TABLE "platform_settings" (
      "key" varchar(80) PRIMARY KEY,
      "value" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`INSERT INTO "platform_settings" ("key", "value") VALUES
      ('role_permissions', '{"Super Admin":["view_users","manage_users","review_verification","resolve_reports","manage_admins","manage_system"],"Trust & Safety":["view_users","review_verification","resolve_reports"],"Support":["view_users"]}'::jsonb),
      ('system_controls', '{"matching":true,"maintenance":false,"weeklyLimit":5}'::jsonb)`);

    await queryRunner.query(`CREATE TABLE "relationship_tool_states" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "match_id" uuid NOT NULL UNIQUE REFERENCES "matches"("id") ON DELETE CASCADE,
      "devotional_day" smallint NOT NULL DEFAULT 0,
      "reflections" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "discussed_topics" text[] NOT NULL DEFAULT '{}',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "relationship_tool_states"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_settings"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "admin_preferences"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "permissions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "admin_role"`);
  }
}
