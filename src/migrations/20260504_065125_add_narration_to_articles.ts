import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_users_role" ADD VALUE 'narrator' BEFORE 'member';
  ALTER TABLE "articles" ADD COLUMN "narration_id" integer;
  ALTER TABLE "_articles_v" ADD COLUMN "version_narration_id" integer;
  ALTER TABLE "media" ADD COLUMN "narrator_id" integer;
  ALTER TABLE "media" ADD COLUMN "duration" numeric;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_narration_id_media_id_fk" FOREIGN KEY ("narration_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_narration_id_media_id_fk" FOREIGN KEY ("version_narration_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_narrator_id_users_id_fk" FOREIGN KEY ("narrator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "articles_narration_idx" ON "articles" USING btree ("narration_id");
  CREATE INDEX "_articles_v_version_version_narration_idx" ON "_articles_v" USING btree ("version_narration_id");
  CREATE INDEX "media_narrator_idx" ON "media" USING btree ("narrator_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP CONSTRAINT "articles_narration_id_media_id_fk";
  
  ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_narration_id_media_id_fk";
  
  ALTER TABLE "media" DROP CONSTRAINT "media_narrator_id_users_id_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'chief-editor', 'editor', 'writer', 'member');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "articles_narration_idx";
  DROP INDEX "_articles_v_version_version_narration_idx";
  DROP INDEX "media_narrator_idx";
  ALTER TABLE "articles" DROP COLUMN "narration_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_narration_id";
  ALTER TABLE "media" DROP COLUMN "narrator_id";
  ALTER TABLE "media" DROP COLUMN "duration";`)
}
