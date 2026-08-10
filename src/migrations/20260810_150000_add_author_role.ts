import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_users_roles" ADD VALUE IF NOT EXISTS 'author' BEFORE 'member';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop a value from an enum type, so rebuild it without
  // 'author', demoting anyone who holds it to 'member' first.
  await db.execute(sql`
   UPDATE "users_roles" SET "value" = 'member' WHERE "value" = 'author';

  ALTER TYPE "public"."enum_users_roles" RENAME TO "enum_users_roles_old";

  CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'chief-editor', 'editor', 'writer', 'narrator', 'member');

  ALTER TABLE "users_roles" ALTER COLUMN "value" TYPE "public"."enum_users_roles" USING "value"::text::"public"."enum_users_roles";

  DROP TYPE "public"."enum_users_roles_old";`)
}
