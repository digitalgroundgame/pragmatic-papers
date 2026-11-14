import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_whip_counts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__whip_counts_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "whip_counts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" varchar,
  	"data" jsonb,
  	"methodology" varchar,
  	"published_at" timestamp(3) with time zone,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_whip_counts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_whip_counts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_intro" varchar,
  	"version_data" jsonb,
  	"version_methodology" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__whip_counts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "whip_counts_id" integer;
  ALTER TABLE "_whip_counts_v" ADD CONSTRAINT "_whip_counts_v_parent_id_whip_counts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."whip_counts"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "whip_counts_slug_idx" ON "whip_counts" USING btree ("slug");
  CREATE INDEX "whip_counts_updated_at_idx" ON "whip_counts" USING btree ("updated_at");
  CREATE INDEX "whip_counts_created_at_idx" ON "whip_counts" USING btree ("created_at");
  CREATE INDEX "whip_counts__status_idx" ON "whip_counts" USING btree ("_status");
  CREATE INDEX "_whip_counts_v_parent_idx" ON "_whip_counts_v" USING btree ("parent_id");
  CREATE INDEX "_whip_counts_v_version_version_slug_idx" ON "_whip_counts_v" USING btree ("version_slug");
  CREATE INDEX "_whip_counts_v_version_version_updated_at_idx" ON "_whip_counts_v" USING btree ("version_updated_at");
  CREATE INDEX "_whip_counts_v_version_version_created_at_idx" ON "_whip_counts_v" USING btree ("version_created_at");
  CREATE INDEX "_whip_counts_v_version_version__status_idx" ON "_whip_counts_v" USING btree ("version__status");
  CREATE INDEX "_whip_counts_v_created_at_idx" ON "_whip_counts_v" USING btree ("created_at");
  CREATE INDEX "_whip_counts_v_updated_at_idx" ON "_whip_counts_v" USING btree ("updated_at");
  CREATE INDEX "_whip_counts_v_latest_idx" ON "_whip_counts_v" USING btree ("latest");
  CREATE INDEX "_whip_counts_v_autosave_idx" ON "_whip_counts_v" USING btree ("autosave");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_whip_counts_fk" FOREIGN KEY ("whip_counts_id") REFERENCES "public"."whip_counts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_whip_counts_id_idx" ON "payload_locked_documents_rels" USING btree ("whip_counts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "whip_counts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_whip_counts_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "whip_counts" CASCADE;
  DROP TABLE "_whip_counts_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_whip_counts_fk";
  
  DROP INDEX "payload_locked_documents_rels_whip_counts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "whip_counts_id";
  DROP TYPE "public"."enum_whip_counts_status";
  DROP TYPE "public"."enum__whip_counts_v_version_status";`)
}
