import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_commenting" AS ENUM('open', 'locked', 'off');
  CREATE TYPE "public"."enum__articles_v_version_commenting" AS ENUM('open', 'locked', 'off');
  ALTER TABLE "articles" ADD COLUMN "commenting" "enum_articles_commenting" DEFAULT 'open';
  ALTER TABLE "_articles_v" ADD COLUMN "version_commenting" "enum__articles_v_version_commenting" DEFAULT 'open';
  ALTER TABLE "users" ADD COLUMN "first_commented_at" timestamp(3) with time zone;
  ALTER TABLE "achievements" ADD COLUMN "key" varchar;
  CREATE UNIQUE INDEX "achievements_key_idx" ON "achievements" USING btree ("key");`)
  // The starter achievements a deploy already made carry no key: give it to the oldest of each
  // rule, which is the one the deploy made. The hand-given Verified is new, and gets its key when
  // it's made.
  await db.execute(sql`
  UPDATE "achievements" SET "key" = 'early-member'
    WHERE "id" = (SELECT min("id") FROM "achievements" WHERE "rule" = 'firstMembers');
  UPDATE "achievements" SET "key" = 'verified'
    WHERE "id" = (SELECT min("id") FROM "achievements" WHERE "rule" = 'verified');`)
  // Nearly every reader verifies their email, so that achievement now shows no badge, and its old
  // name goes to the hand-given Verified. Left alone if an editor renamed it.
  await db.execute(sql`
  UPDATE "achievements" SET "name" = 'Email verified', "badge" = false
    WHERE "key" = 'verified' AND "name" = 'Verified';`)
  // Each commenter's earliest published comment, which the comments plugin keeps from now on.
  await db.execute(sql`
   UPDATE "users" SET "first_commented_at" = "first"."created_at"
   FROM (
     SELECT "author_id", min("created_at") AS "created_at" FROM "comments"
     WHERE "status" = 'published' AND "author_id" IS NOT NULL
     GROUP BY "author_id"
   ) AS "first"
   WHERE "users"."id" = "first"."author_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "achievements_key_idx";
  ALTER TABLE "articles" DROP COLUMN "commenting";
  ALTER TABLE "_articles_v" DROP COLUMN "version_commenting";
  ALTER TABLE "users" DROP COLUMN "first_commented_at";
  ALTER TABLE "achievements" DROP COLUMN "key";
  DROP TYPE "public"."enum_articles_commenting";
  DROP TYPE "public"."enum__articles_v_version_commenting";`)
}
