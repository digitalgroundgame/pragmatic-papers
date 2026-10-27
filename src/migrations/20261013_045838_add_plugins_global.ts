import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "plugins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"switches_docs" boolean DEFAULT false,
  	"switches_notifications" boolean DEFAULT false,
  	"switches_tours" boolean DEFAULT false,
  	"switches_sso" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
  // The four plugins' switches were experiments in Settings: carry each site's choice over.
  // The Settings columns stay for now, so a deploy's old container can still read them.
  await db.execute(sql`
   INSERT INTO "plugins" ("switches_docs", "switches_notifications", "switches_tours", "switches_sso", "updated_at", "created_at")
   SELECT "experiments_docs", "experiments_notifications", "experiments_tours", "experiments_sso", now(), now()
   FROM "site_settings"
   ORDER BY "id"
   LIMIT 1;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "plugins" CASCADE;`)
}
