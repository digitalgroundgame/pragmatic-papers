import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "integrations_substack_publications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"publication" varchar NOT NULL
  );
  
  ALTER TABLE "integrations_substack_publications" ADD CONSTRAINT "integrations_substack_publications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "integrations_substack_publications_order_idx" ON "integrations_substack_publications" USING btree ("_order");
  CREATE INDEX "integrations_substack_publications_parent_id_idx" ON "integrations_substack_publications" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "integrations_substack_publications" CASCADE;`)
}
