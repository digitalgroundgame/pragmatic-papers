import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_hero_links" ALTER COLUMN "link_variant" SET DEFAULT 'default';
  ALTER TABLE "_pages_v_version_hero_links" ALTER COLUMN "link_variant" SET DEFAULT 'default';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_hero_links" ALTER COLUMN "link_variant" SET DEFAULT 'link';
  ALTER TABLE "_pages_v_version_hero_links" ALTER COLUMN "link_variant" SET DEFAULT 'link';`)
}
