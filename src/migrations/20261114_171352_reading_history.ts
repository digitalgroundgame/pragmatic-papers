import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "articles_read" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"article_id" integer NOT NULL,
  	"read_at" timestamp(3) with time zone NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "reading_days_visited" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN "reading_last_visit_on" varchar;
  ALTER TABLE "users" ADD COLUMN "reading_current_streak" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN "reading_longest_streak" numeric DEFAULT 0;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "articles_read_id" integer;
  ALTER TABLE "articles_read" ADD CONSTRAINT "articles_read_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_read" ADD CONSTRAINT "articles_read_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "articles_read_user_idx" ON "articles_read" USING btree ("user_id");
  CREATE INDEX "articles_read_article_idx" ON "articles_read" USING btree ("article_id");
  CREATE UNIQUE INDEX "user_article_idx" ON "articles_read" USING btree ("user_id","article_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_read_fk" FOREIGN KEY ("articles_read_id") REFERENCES "public"."articles_read"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_articles_read_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_read_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_read" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles_read" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_articles_read_fk";
  
  DROP INDEX "payload_locked_documents_rels_articles_read_id_idx";
  ALTER TABLE "users" DROP COLUMN "reading_days_visited";
  ALTER TABLE "users" DROP COLUMN "reading_last_visit_on";
  ALTER TABLE "users" DROP COLUMN "reading_current_streak";
  ALTER TABLE "users" DROP COLUMN "reading_longest_streak";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "articles_read_id";`)
}
