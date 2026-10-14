import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_docs_section" ADD VALUE 'pages' BEFORE 'site';
  ALTER TYPE "public"."enum_docs_section" ADD VALUE 'moderation' BEFORE 'site';
  ALTER TYPE "public"."enum__docs_v_version_section" ADD VALUE 'pages' BEFORE 'site';
  ALTER TYPE "public"."enum__docs_v_version_section" ADD VALUE 'moderation' BEFORE 'site';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "docs" SET "section" = 'site' WHERE "section" IN ('pages', 'moderation');
  UPDATE "_docs_v" SET "version_section" = 'site' WHERE "version_section" IN ('pages', 'moderation');
   ALTER TABLE "docs" ALTER COLUMN "section" SET DATA TYPE text;
  ALTER TABLE "docs" ALTER COLUMN "section" SET DEFAULT 'getting-started'::text;
  DROP TYPE "public"."enum_docs_section";
  CREATE TYPE "public"."enum_docs_section" AS ENUM('getting-started', 'writing', 'blocks', 'media', 'site');
  ALTER TABLE "docs" ALTER COLUMN "section" SET DEFAULT 'getting-started'::"public"."enum_docs_section";
  ALTER TABLE "docs" ALTER COLUMN "section" SET DATA TYPE "public"."enum_docs_section" USING "section"::"public"."enum_docs_section";
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DATA TYPE text;
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DEFAULT 'getting-started'::text;
  DROP TYPE "public"."enum__docs_v_version_section";
  CREATE TYPE "public"."enum__docs_v_version_section" AS ENUM('getting-started', 'writing', 'blocks', 'media', 'site');
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DEFAULT 'getting-started'::"public"."enum__docs_v_version_section";
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DATA TYPE "public"."enum__docs_v_version_section" USING "version_section"::"public"."enum__docs_v_version_section";`)
}
