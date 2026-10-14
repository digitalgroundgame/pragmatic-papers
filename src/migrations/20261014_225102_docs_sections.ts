import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

// The sections' stored values now match their folders and sidebar names: rows keep their
// section through the rename (writing → articles, site → site-settings).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" ALTER COLUMN "section" SET DATA TYPE text;
  ALTER TABLE "docs" ALTER COLUMN "section" SET DEFAULT 'getting-started'::text;
  UPDATE "docs" SET "section" = 'articles' WHERE "section" IN ('writing');
  UPDATE "docs" SET "section" = 'site-settings' WHERE "section" IN ('site');
  DROP TYPE "public"."enum_docs_section";
  CREATE TYPE "public"."enum_docs_section" AS ENUM('getting-started', 'articles', 'blocks', 'media', 'pages-and-volumes', 'moderation', 'site-settings');
  ALTER TABLE "docs" ALTER COLUMN "section" SET DEFAULT 'getting-started'::"public"."enum_docs_section";
  ALTER TABLE "docs" ALTER COLUMN "section" SET DATA TYPE "public"."enum_docs_section" USING "section"::"public"."enum_docs_section";
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DATA TYPE text;
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DEFAULT 'getting-started'::text;
  UPDATE "_docs_v" SET "version_section" = 'articles' WHERE "version_section" IN ('writing');
  UPDATE "_docs_v" SET "version_section" = 'site-settings' WHERE "version_section" IN ('site');
  DROP TYPE "public"."enum__docs_v_version_section";
  CREATE TYPE "public"."enum__docs_v_version_section" AS ENUM('getting-started', 'articles', 'blocks', 'media', 'pages-and-volumes', 'moderation', 'site-settings');
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DEFAULT 'getting-started'::"public"."enum__docs_v_version_section";
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DATA TYPE "public"."enum__docs_v_version_section" USING "version_section"::"public"."enum__docs_v_version_section";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" ALTER COLUMN "section" SET DATA TYPE text;
  ALTER TABLE "docs" ALTER COLUMN "section" SET DEFAULT 'getting-started'::text;
  UPDATE "docs" SET "section" = 'writing' WHERE "section" IN ('articles');
  UPDATE "docs" SET "section" = 'site' WHERE "section" IN ('site-settings', 'pages-and-volumes', 'moderation');
  DROP TYPE "public"."enum_docs_section";
  CREATE TYPE "public"."enum_docs_section" AS ENUM('getting-started', 'writing', 'blocks', 'media', 'site');
  ALTER TABLE "docs" ALTER COLUMN "section" SET DEFAULT 'getting-started'::"public"."enum_docs_section";
  ALTER TABLE "docs" ALTER COLUMN "section" SET DATA TYPE "public"."enum_docs_section" USING "section"::"public"."enum_docs_section";
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DATA TYPE text;
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DEFAULT 'getting-started'::text;
  UPDATE "_docs_v" SET "version_section" = 'writing' WHERE "version_section" IN ('articles');
  UPDATE "_docs_v" SET "version_section" = 'site' WHERE "version_section" IN ('site-settings', 'pages-and-volumes', 'moderation');
  DROP TYPE "public"."enum__docs_v_version_section";
  CREATE TYPE "public"."enum__docs_v_version_section" AS ENUM('getting-started', 'writing', 'blocks', 'media', 'site');
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DEFAULT 'getting-started'::"public"."enum__docs_v_version_section";
  ALTER TABLE "_docs_v" ALTER COLUMN "version_section" SET DATA TYPE "public"."enum__docs_v_version_section" USING "version_section"::"public"."enum__docs_v_version_section";`)
}
