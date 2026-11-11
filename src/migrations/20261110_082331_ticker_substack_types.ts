import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_integrations_substack_types" AS ENUM('podcast', 'video', 'post');
  CREATE TABLE "integrations_substack_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_integrations_substack_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "integrations_substack_types" ADD CONSTRAINT "integrations_substack_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "integrations_substack_types_order_idx" ON "integrations_substack_types" USING btree ("order");
  CREATE INDEX "integrations_substack_types_parent_idx" ON "integrations_substack_types" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "integrations_substack_types" CASCADE;
  DROP TYPE "public"."enum_integrations_substack_types";`)
}
