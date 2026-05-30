import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_rels" ADD COLUMN "topics_id" integer;
  ALTER TABLE "header_rels" ADD COLUMN "topics_id" integer;
  ALTER TABLE "footer_rels" ADD COLUMN "topics_id" integer;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_rels" ADD CONSTRAINT "header_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rels_topics_id_idx" ON "users_rels" USING btree ("topics_id");
  CREATE INDEX "header_rels_topics_id_idx" ON "header_rels" USING btree ("topics_id");
  CREATE INDEX "footer_rels_topics_id_idx" ON "footer_rels" USING btree ("topics_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_rels" DROP CONSTRAINT "users_rels_topics_fk";
  
  ALTER TABLE "header_rels" DROP CONSTRAINT "header_rels_topics_fk";
  
  ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_topics_fk";
  
  DROP INDEX "users_rels_topics_id_idx";
  DROP INDEX "header_rels_topics_id_idx";
  DROP INDEX "footer_rels_topics_id_idx";
  ALTER TABLE "users_rels" DROP COLUMN "topics_id";
  ALTER TABLE "header_rels" DROP COLUMN "topics_id";
  ALTER TABLE "footer_rels" DROP COLUMN "topics_id";`)
}
