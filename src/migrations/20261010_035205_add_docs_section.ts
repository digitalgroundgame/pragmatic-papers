import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_docs_section" AS ENUM('getting-started', 'writing', 'blocks', 'media', 'site');
  CREATE TYPE "public"."enum__docs_v_version_section" AS ENUM('getting-started', 'writing', 'blocks', 'media', 'site');
  ALTER TABLE "docs" ADD COLUMN "section" "enum_docs_section" DEFAULT 'getting-started';
  ALTER TABLE "_docs_v" ADD COLUMN "version_section" "enum__docs_v_version_section" DEFAULT 'getting-started';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs" DROP COLUMN "section";
  ALTER TABLE "_docs_v" DROP COLUMN "version_section";
  DROP TYPE "public"."enum_docs_section";
  DROP TYPE "public"."enum__docs_v_version_section";`)
}
