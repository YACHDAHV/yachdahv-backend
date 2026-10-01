import { MigrationInterface, QueryRunner } from "typeorm";

export class FavoriteMatches1721413100000 implements MigrationInterface {
  name = "FavoriteMatches1721413100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "favorite_matches" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "member_id" uuid NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_favorite_matches_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_favorite_matches_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_favorite_matches_member" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_favorite_matches_user_member" ON "favorite_matches" ("user_id", "member_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "favorite_matches"`);
  }
}
