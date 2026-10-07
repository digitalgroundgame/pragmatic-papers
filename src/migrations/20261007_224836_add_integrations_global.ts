import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "integrations_youtube_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel_id" varchar NOT NULL
  );
  
  CREATE TABLE "integrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"bluesky_handle" varchar,
  	"x_username" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "integrations_youtube_channels" ADD CONSTRAINT "integrations_youtube_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "integrations_youtube_channels_order_idx" ON "integrations_youtube_channels" USING btree ("_order");
  CREATE INDEX "integrations_youtube_channels_parent_id_idx" ON "integrations_youtube_channels" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "integrations_youtube_channels" CASCADE;
  DROP TABLE "integrations" CASCADE;`)
}
