import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1721412000000 implements MigrationInterface {
  name = "InitialSchema1721412000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('member','admin','super_admin')`);
    await queryRunner.query(`CREATE TYPE "users_status_enum" AS ENUM ('active','suspended','deactivated')`);
    await queryRunner.query(`CREATE TYPE "verification_status_enum" AS ENUM ('not_started','submitted','verified','rejected')`);
    await queryRunner.query(`CREATE TYPE "matches_status_enum" AS ENUM ('suggested','matched','passed')`);
    await queryRunner.query(`CREATE TYPE "reports_status_enum" AS ENUM ('open','reviewing','resolved','dismissed')`);

    await queryRunner.query(`CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar(160), "phone" varchar(40),
      "password_hash" varchar(120), "name" varchar(80) NOT NULL,
      "role" users_role_enum NOT NULL DEFAULT 'member', "status" users_status_enum NOT NULL DEFAULT 'active',
      "phone_verified" boolean NOT NULL DEFAULT false, "onboarding_completed" boolean NOT NULL DEFAULT false,
      "identity_status" verification_status_enum NOT NULL DEFAULT 'not_started',
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "users_email_unique" UNIQUE ("email"), CONSTRAINT "users_phone_unique" UNIQUE ("phone"))`);
    await queryRunner.query(`CREATE TABLE "profiles" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      "age" smallint, "gender" varchar(20), "occupation" varchar(80), "country" varchar(60), "city" varchar(80),
      "bio" varchar(200), "church" varchar(100), "invite_code" varchar(40), "intention" varchar(80),
      "looking_for" varchar(300), "children" varchar(60), "education" varchar(100), "denomination" varchar(80),
      "height_cm" smallint, "interests" text[] NOT NULL DEFAULT '{}', "photos" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE TABLE "preferences" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      "min_age" smallint, "max_age" smallint, "location" varchar(80), "max_distance_km" smallint,
      "education" varchar(100), "updated_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE TABLE "phone_codes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "phone" varchar(40) NOT NULL, "code_hash" varchar(120) NOT NULL,
      "expires_at" timestamptz NOT NULL, "used_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX "phone_codes_phone_idx" ON phone_codes(phone)`);
    await queryRunner.query(`CREATE TABLE "refresh_tokens" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "token_hash" varchar(120) NOT NULL, "expires_at" timestamptz NOT NULL, "revoked_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX "refresh_tokens_user_idx" ON refresh_tokens(user_id)`);
    await queryRunner.query(`CREATE TABLE "matches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_a_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "user_b_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, "status" matches_status_enum NOT NULL DEFAULT 'suggested',
      "liked_by_a" boolean NOT NULL DEFAULT false, "liked_by_b" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "matches_pair_unique" UNIQUE ("user_a_id", "user_b_id"),
      CONSTRAINT "matches_distinct_users" CHECK ("user_a_id" <> "user_b_id"))`);
    await queryRunner.query(`CREATE TABLE "conversations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_a_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "user_b_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "conversations_pair_unique" UNIQUE ("user_a_id", "user_b_id"),
      CONSTRAINT "conversations_distinct_users" CHECK ("user_a_id" <> "user_b_id"))`);
    await queryRunner.query(`CREATE TABLE "messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "conversation_id" uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      "sender_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, "body" text NOT NULL,
      "read_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX "messages_conversation_idx" ON messages(conversation_id, created_at)`);
    await queryRunner.query(`CREATE TABLE "notifications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "type" varchar(60) NOT NULL, "title" varchar(120) NOT NULL, "body" varchar(300) NOT NULL,
      "data" jsonb NOT NULL DEFAULT '{}'::jsonb, "read_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX "notifications_user_idx" ON notifications(user_id, created_at DESC)`);
    await queryRunner.query(`CREATE TABLE "blocks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "blocker_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "blocked_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "blocks_pair_unique" UNIQUE ("blocker_id", "blocked_id"),
      CONSTRAINT "blocks_distinct_users" CHECK ("blocker_id" <> "blocked_id"))`);
    await queryRunner.query(`CREATE TABLE "reports" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "reporter_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "reported_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, "reason" varchar(80) NOT NULL,
      "details" varchar(500), "status" reports_status_enum NOT NULL DEFAULT 'open',
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "reports_distinct_users" CHECK ("reporter_id" <> "reported_id"))`);
    await queryRunner.query(`CREATE TABLE "verification_submissions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "document_type" varchar(40) NOT NULL, "document_key" varchar(240) NOT NULL, "selfie_key" varchar(240),
      "status" verification_status_enum NOT NULL DEFAULT 'submitted', "review_note" varchar(500),
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX "verification_user_idx" ON verification_submissions(user_id, created_at DESC)`);
    await queryRunner.query(`CREATE TABLE "audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "actor_id" uuid, "action" varchar(80) NOT NULL,
      "target_type" varchar(60) NOT NULL, "target_id" varchar(80), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX "audit_logs_created_idx" ON audit_logs(created_at DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ["audit_logs", "verification_submissions", "reports", "blocks", "notifications", "messages", "conversations", "matches", "refresh_tokens", "phone_codes", "preferences", "profiles", "users"]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    await queryRunner.query(`DROP TYPE IF EXISTS "reports_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "matches_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "verification_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
