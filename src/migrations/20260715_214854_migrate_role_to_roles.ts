import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_users_role" RENAME TO "enum_users_roles";
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );

  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");

  INSERT INTO "users_roles" ("order", "parent_id", "value")
  SELECT 0, "id", "role" FROM "users" WHERE "role" IS NOT NULL;

  ALTER TABLE "users" DROP COLUMN "role";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'chief-editor', 'editor', 'writer', 'narrator', 'member');
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'member';

  UPDATE "users" u
  SET "role" = (
    SELECT ur."value"::text::"public"."enum_users_role"
    FROM "users_roles" ur
    WHERE ur."parent_id" = u."id"
    ORDER BY ur."order" ASC
    LIMIT 1
  )
  WHERE EXISTS (
    SELECT 1 FROM "users_roles" ur WHERE ur."parent_id" = u."id"
  );

  DROP TABLE "users_roles" CASCADE;
  DROP TYPE "public"."enum_users_roles";`)
}
