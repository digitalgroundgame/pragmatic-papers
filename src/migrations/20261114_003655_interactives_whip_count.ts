import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Whip counts move into the interactives collection, as the "whip-count" profile with the
  // count in the interactive's snapshot. Their own tables are dropped rather than copied: the
  // only one was a showcase draft on staging, which the showcase recreates. The locked-documents
  // column goes before the tables, since dropping a table with CASCADE takes its foreign key too.
  await db.execute(sql`
  ALTER TYPE "public"."enum_interactives_profile" ADD VALUE 'whip-count';
  ALTER TYPE "public"."enum__interactives_v_version_profile" ADD VALUE 'whip-count';
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_whip_counts_fk";
  DROP INDEX "payload_locked_documents_rels_whip_counts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "whip_counts_id";
  ALTER TABLE "whip_counts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_whip_counts_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "whip_counts" CASCADE;
  DROP TABLE "_whip_counts_v" CASCADE;
  ALTER TABLE "interactives" ADD COLUMN "methodology" varchar;
  ALTER TABLE "_interactives_v" ADD COLUMN "version_methodology" varchar;
  DROP TYPE "public"."enum_whip_counts_status";
  DROP TYPE "public"."enum__whip_counts_v_version_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_whip_counts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__whip_counts_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "whip_counts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" varchar,
  	"data" jsonb,
  	"auto_publish" boolean DEFAULT false,
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
  	"version_auto_publish" boolean DEFAULT false,
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
  
  ALTER TABLE "interactives" ALTER COLUMN "profile" SET DATA TYPE text;
  DROP TYPE "public"."enum_interactives_profile";
  CREATE TYPE "public"."enum_interactives_profile" AS ENUM('federal-courts');
  ALTER TABLE "interactives" ALTER COLUMN "profile" SET DATA TYPE "public"."enum_interactives_profile" USING "profile"::"public"."enum_interactives_profile";
  ALTER TABLE "_interactives_v" ALTER COLUMN "version_profile" SET DATA TYPE text;
  DROP TYPE "public"."enum__interactives_v_version_profile";
  CREATE TYPE "public"."enum__interactives_v_version_profile" AS ENUM('federal-courts');
  ALTER TABLE "_interactives_v" ALTER COLUMN "version_profile" SET DATA TYPE "public"."enum__interactives_v_version_profile" USING "version_profile"::"public"."enum__interactives_v_version_profile";
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
  CREATE INDEX "payload_locked_documents_rels_whip_counts_id_idx" ON "payload_locked_documents_rels" USING btree ("whip_counts_id");
  ALTER TABLE "interactives" DROP COLUMN "methodology";
  ALTER TABLE "_interactives_v" DROP COLUMN "version_methodology";`)
}
