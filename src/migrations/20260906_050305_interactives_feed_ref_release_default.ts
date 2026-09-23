import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "interactives" ALTER COLUMN "feed_ref" SET DEFAULT 'release';
  ALTER TABLE "_interactives_v" ALTER COLUMN "version_feed_ref" SET DEFAULT 'release';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "interactives" ALTER COLUMN "feed_ref" SET DEFAULT 'main';
  ALTER TABLE "_interactives_v" ALTER COLUMN "version_feed_ref" SET DEFAULT 'main';`)
}
