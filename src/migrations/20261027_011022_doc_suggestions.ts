import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_doc_suggestions_status" AS ENUM('open', 'resolved', 'dismissed');
  CREATE TABLE "doc_suggestions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"doc_id" integer,
  	"status" "enum_doc_suggestions_status" DEFAULT 'open' NOT NULL,
  	"resolved_by_id" integer,
  	"resolved_at" timestamp(3) with time zone,
  	"note" varchar,
  	"changes" varchar,
  	"from_source" varchar,
  	"to_source" varchar,
  	"from_hash" varchar,
  	"to_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "doc_suggestions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "doc_suggestions_id" integer;
  ALTER TABLE "doc_suggestions" ADD CONSTRAINT "doc_suggestions_doc_id_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doc_suggestions" ADD CONSTRAINT "doc_suggestions_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doc_suggestions_rels" ADD CONSTRAINT "doc_suggestions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doc_suggestions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doc_suggestions_rels" ADD CONSTRAINT "doc_suggestions_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "doc_suggestions_doc_idx" ON "doc_suggestions" USING btree ("doc_id");
  CREATE INDEX "doc_suggestions_status_idx" ON "doc_suggestions" USING btree ("status");
  CREATE INDEX "doc_suggestions_resolved_by_idx" ON "doc_suggestions" USING btree ("resolved_by_id");
  CREATE INDEX "doc_suggestions_updated_at_idx" ON "doc_suggestions" USING btree ("updated_at");
  CREATE INDEX "doc_suggestions_created_at_idx" ON "doc_suggestions" USING btree ("created_at");
  CREATE INDEX "doc_suggestions_rels_order_idx" ON "doc_suggestions_rels" USING btree ("order");
  CREATE INDEX "doc_suggestions_rels_parent_idx" ON "doc_suggestions_rels" USING btree ("parent_id");
  CREATE INDEX "doc_suggestions_rels_path_idx" ON "doc_suggestions_rels" USING btree ("path");
  CREATE INDEX "doc_suggestions_rels_media_id_idx" ON "doc_suggestions_rels" USING btree ("media_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doc_suggestions_fk" FOREIGN KEY ("doc_suggestions_id") REFERENCES "public"."doc_suggestions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_doc_suggestions_id_idx" ON "payload_locked_documents_rels" USING btree ("doc_suggestions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_doc_suggestions_fk";
  DROP INDEX "payload_locked_documents_rels_doc_suggestions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "doc_suggestions_id";
  DROP TABLE "doc_suggestions_rels" CASCADE;
  DROP TABLE "doc_suggestions" CASCADE;
  DROP TYPE "public"."enum_doc_suggestions_status";`)
}
