import { MigrationInterface, QueryRunner } from "typeorm";

export class MessageMeta1721413000000 implements MigrationInterface {
  name = "MessageMeta1721413000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "meta" jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN IF EXISTS "meta"`);
  }
}
