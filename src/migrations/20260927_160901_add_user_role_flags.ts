import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "is_author" boolean;
  ALTER TABLE "users" ADD COLUMN "is_narrator" boolean;
  CREATE INDEX "users_is_author_idx" ON "users" USING btree ("is_author");
  CREATE INDEX "users_is_narrator_idx" ON "users" USING btree ("is_narrator");

  UPDATE "users" SET
    "is_author" = EXISTS (
      SELECT 1 FROM "users_roles"
      WHERE "users_roles"."parent_id" = "users"."id"
        AND "users_roles"."value" IN ('writer', 'editor', 'chief-editor', 'narrator')
    ),
    "is_narrator" = EXISTS (
      SELECT 1 FROM "users_roles"
      WHERE "users_roles"."parent_id" = "users"."id"
        AND "users_roles"."value" = 'narrator'
    );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_is_author_idx";
  DROP INDEX "users_is_narrator_idx";
  ALTER TABLE "users" DROP COLUMN "is_author";
  ALTER TABLE "users" DROP COLUMN "is_narrator";`)
}
