import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_achievements_achievement" AS ENUM('early-member', 'verified');
  CREATE TABLE "achievements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"achievement" "enum_achievements_achievement" NOT NULL,
  	"earned_at" timestamp(3) with time zone,
  	"revoked" boolean DEFAULT false,
  	"revoked_reason" varchar,
  	"revoked_at" timestamp(3) with time zone,
  	"revoked_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "achievements_id" integer;
  ALTER TABLE "plugins" ADD COLUMN "switches_achievements" boolean DEFAULT false;
  ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "achievements" ADD CONSTRAINT "achievements_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "achievements_user_idx" ON "achievements" USING btree ("user_id");
  CREATE INDEX "achievements_achievement_idx" ON "achievements" USING btree ("achievement");
  CREATE INDEX "achievements_revoked_idx" ON "achievements" USING btree ("revoked");
  CREATE INDEX "achievements_revoked_by_idx" ON "achievements" USING btree ("revoked_by_id");
  CREATE INDEX "achievements_updated_at_idx" ON "achievements" USING btree ("updated_at");
  CREATE INDEX "achievements_created_at_idx" ON "achievements" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_achievement_idx" ON "achievements" USING btree ("user_id","achievement");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_achievements_fk" FOREIGN KEY ("achievements_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_achievements_id_idx" ON "payload_locked_documents_rels" USING btree ("achievements_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "achievements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "achievements" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_achievements_fk";
  
  DROP INDEX "payload_locked_documents_rels_achievements_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "achievements_id";
  ALTER TABLE "plugins" DROP COLUMN "switches_achievements";
  DROP TYPE "public"."enum_achievements_achievement";`)
}
