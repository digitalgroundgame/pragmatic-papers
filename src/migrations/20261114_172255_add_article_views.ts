import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "article_views" (
  	"article_id" integer NOT NULL,
  	"day" date NOT NULL,
  	"views" integer DEFAULT 0 NOT NULL,
  	CONSTRAINT "article_views_pkey" PRIMARY KEY("article_id","day")
  );
  
  ALTER TABLE "article_views" ADD CONSTRAINT "article_views_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "article_views_day_idx" ON "article_views" USING btree ("day");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "article_views" CASCADE;`)
}
