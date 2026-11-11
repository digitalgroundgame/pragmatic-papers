import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_commenting" AS ENUM('open', 'locked', 'off');
  CREATE TYPE "public"."enum__articles_v_version_commenting" AS ENUM('open', 'locked', 'off');
  ALTER TABLE "articles" ADD COLUMN "commenting" "enum_articles_commenting" DEFAULT 'open';
  ALTER TABLE "_articles_v" ADD COLUMN "version_commenting" "enum__articles_v_version_commenting" DEFAULT 'open';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "commenting";
  ALTER TABLE "_articles_v" DROP COLUMN "version_commenting";
  DROP TYPE "public"."enum_articles_commenting";
  DROP TYPE "public"."enum__articles_v_version_commenting";`)
}
