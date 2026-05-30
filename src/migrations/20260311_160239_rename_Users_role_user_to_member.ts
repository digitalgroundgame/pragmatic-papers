import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  UPDATE "users" SET "role" = 'member' WHERE "role" = 'user';
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'chief-editor', 'editor', 'writer', 'member');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  UPDATE "users" SET "role" = 'user' WHERE "role" = 'member';
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'chief-editor', 'editor', 'writer', 'user');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";`)
}
