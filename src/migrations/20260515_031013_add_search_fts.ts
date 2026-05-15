import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "search" ADD COLUMN "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')),   'A') ||
        setweight(to_tsvector('english', coalesce("authors", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("excerpt", '')), 'C') ||
        setweight(to_tsvector('english', coalesce("body", '')),    'D')
      ) STORED;

    CREATE INDEX "search_search_vector_idx"
      ON "search" USING GIN ("search_vector");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "search_search_vector_idx";
    ALTER TABLE "search" DROP COLUMN IF EXISTS "search_vector";
  `)
}
