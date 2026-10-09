import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "integrations_youtube_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel_id" varchar NOT NULL
  );
  
  CREATE TABLE "integrations_bluesky_handles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"handle" varchar NOT NULL
  );
  
  CREATE TABLE "integrations_x_usernames" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"username" varchar NOT NULL
  );
  
  CREATE TABLE "integrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "ticker_hidden" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "ticker" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "site_settings" ADD COLUMN "experiments_ticker" boolean DEFAULT false;
  ALTER TABLE "integrations_youtube_channels" ADD CONSTRAINT "integrations_youtube_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "integrations_bluesky_handles" ADD CONSTRAINT "integrations_bluesky_handles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "integrations_x_usernames" ADD CONSTRAINT "integrations_x_usernames_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ticker_hidden" ADD CONSTRAINT "ticker_hidden_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ticker"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "integrations_youtube_channels_order_idx" ON "integrations_youtube_channels" USING btree ("_order");
  CREATE INDEX "integrations_youtube_channels_parent_id_idx" ON "integrations_youtube_channels" USING btree ("_parent_id");
  CREATE INDEX "integrations_bluesky_handles_order_idx" ON "integrations_bluesky_handles" USING btree ("_order");
  CREATE INDEX "integrations_bluesky_handles_parent_id_idx" ON "integrations_bluesky_handles" USING btree ("_parent_id");
  CREATE INDEX "integrations_x_usernames_order_idx" ON "integrations_x_usernames" USING btree ("_order");
  CREATE INDEX "integrations_x_usernames_parent_id_idx" ON "integrations_x_usernames" USING btree ("_parent_id");
  CREATE INDEX "ticker_hidden_order_idx" ON "ticker_hidden" USING btree ("_order");
  CREATE INDEX "ticker_hidden_parent_id_idx" ON "ticker_hidden" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "integrations_youtube_channels" CASCADE;
  DROP TABLE "integrations_bluesky_handles" CASCADE;
  DROP TABLE "integrations_x_usernames" CASCADE;
  DROP TABLE "integrations" CASCADE;
  DROP TABLE "ticker_hidden" CASCADE;
  DROP TABLE "ticker" CASCADE;
  ALTER TABLE "site_settings" DROP COLUMN "experiments_ticker";`)
}
