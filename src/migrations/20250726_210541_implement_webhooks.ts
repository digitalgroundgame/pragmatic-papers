/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "webhooks_pushed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"volume_number" numeric,
  	"time_pushed" timestamp(3) with time zone
  );

  CREATE TABLE "webhooks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"url" varchar NOT NULL,
  	"most_recent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "webhooks_id" integer;
  ALTER TABLE "webhooks_pushed" ADD CONSTRAINT "webhooks_pushed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "webhooks_pushed_order_idx" ON "webhooks_pushed" USING btree ("_order");
  CREATE INDEX "webhooks_pushed_parent_id_idx" ON "webhooks_pushed" USING btree ("_parent_id");
  CREATE INDEX "webhooks_updated_at_idx" ON "webhooks" USING btree ("updated_at");
  CREATE INDEX "webhooks_created_at_idx" ON "webhooks" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhooks_fk" FOREIGN KEY ("webhooks_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_webhooks_id_idx" ON "payload_locked_documents_rels" USING btree ("webhooks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "webhooks_pushed" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "webhooks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "webhooks_pushed" CASCADE;
  DROP TABLE "webhooks" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_webhooks_fk";

  DROP INDEX "payload_locked_documents_rels_webhooks_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "webhooks_id";`)
}
