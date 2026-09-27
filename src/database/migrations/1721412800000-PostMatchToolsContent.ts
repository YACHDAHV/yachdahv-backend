import { MigrationInterface, QueryRunner } from "typeorm";

export class PostMatchToolsContent1721412800000 implements MigrationInterface {
  name = "PostMatchToolsContent1721412800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "relationship_tool_states" ADD COLUMN IF NOT EXISTS "topic_responses" jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await queryRunner.query(`ALTER TABLE "relationship_tool_states" ADD COLUMN IF NOT EXISTS "devotional_plans" jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "relationship_tool_states" DROP COLUMN IF EXISTS "devotional_plans"`);
    await queryRunner.query(`ALTER TABLE "relationship_tool_states" DROP COLUMN IF EXISTS "topic_responses"`);
  }
}
