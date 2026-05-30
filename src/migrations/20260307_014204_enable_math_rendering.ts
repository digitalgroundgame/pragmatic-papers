import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "enable_math_rendering" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_enable_math_rendering" boolean DEFAULT false;

  UPDATE "articles" SET "enable_math_rendering" = true;
  UPDATE "_articles_v" SET "version_enable_math_rendering" = true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "enable_math_rendering";
  ALTER TABLE "_articles_v" DROP COLUMN "version_enable_math_rendering";`)
}
