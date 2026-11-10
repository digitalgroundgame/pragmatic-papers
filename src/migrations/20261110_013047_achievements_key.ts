import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "achievements_key_idx";
  ALTER TABLE "achievements" DROP COLUMN "key";`)
}
