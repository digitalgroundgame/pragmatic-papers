import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

/**
 * The ticker's switch moves from Settings' experiments to the Header global, and its hidden
 * posts from the Ticker global into the Header's ticker group. Both carry over, so a ticker
 * that's on stays on with the same posts hidden.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "header_ticker_hidden" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar
  );
  
  ALTER TABLE "header" ADD COLUMN "ticker_enabled" boolean DEFAULT false;
  ALTER TABLE "header_ticker_hidden" ADD CONSTRAINT "header_ticker_hidden_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "header_ticker_hidden_order_idx" ON "header_ticker_hidden" USING btree ("_order");
  CREATE INDEX "header_ticker_hidden_parent_id_idx" ON "header_ticker_hidden" USING btree ("_parent_id");

  -- A header that was never saved has no row yet; the ticker settings need one.
  INSERT INTO "header" ("updated_at", "created_at")
    SELECT now(), now() WHERE NOT EXISTS (SELECT 1 FROM "header");
  UPDATE "header" SET "ticker_enabled" = COALESCE(
    (SELECT "experiments_ticker" FROM "site_settings" ORDER BY "id" LIMIT 1), false);
  INSERT INTO "header_ticker_hidden" ("_order", "_parent_id", "id", "url")
    SELECT h."_order", (SELECT "id" FROM "header" ORDER BY "id" LIMIT 1), h."id", h."url"
    FROM "ticker_hidden" h;

  DROP TABLE "ticker_hidden" CASCADE;
  DROP TABLE "ticker" CASCADE;
  ALTER TABLE "site_settings" DROP COLUMN "experiments_ticker";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
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
  ALTER TABLE "ticker_hidden" ADD CONSTRAINT "ticker_hidden_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ticker"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ticker_hidden_order_idx" ON "ticker_hidden" USING btree ("_order");
  CREATE INDEX "ticker_hidden_parent_id_idx" ON "ticker_hidden" USING btree ("_parent_id");

  UPDATE "site_settings" SET "experiments_ticker" = COALESCE(
    (SELECT "ticker_enabled" FROM "header" ORDER BY "id" LIMIT 1), false);
  INSERT INTO "ticker" ("updated_at", "created_at")
    SELECT now(), now() WHERE EXISTS (SELECT 1 FROM "header_ticker_hidden");
  INSERT INTO "ticker_hidden" ("_order", "_parent_id", "id", "url")
    SELECT h."_order", (SELECT "id" FROM "ticker" ORDER BY "id" LIMIT 1), h."id", h."url"
    FROM "header_ticker_hidden" h WHERE h."url" IS NOT NULL;

  DROP TABLE "header_ticker_hidden" CASCADE;
  ALTER TABLE "header" DROP COLUMN "ticker_enabled";`)
}
