import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

// Hero and Call to Action links move from the old link field's `appearance` (default, outline)
// to the current link field's `variant`. Drizzle generates this as a new column plus a drop, so each row's
// appearance is copied across before the old column goes.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_hero_links_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum_pages_blocks_cta_links_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum__pages_v_version_hero_links_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  CREATE TYPE "public"."enum__pages_v_blocks_cta_links_link_variant" AS ENUM('link', 'default', 'outline', 'ghost', 'branded');
  ALTER TABLE "pages_hero_links" ADD COLUMN "link_variant" "enum_pages_hero_links_link_variant" DEFAULT 'link';
  ALTER TABLE "pages_blocks_cta_links" ADD COLUMN "link_variant" "enum_pages_blocks_cta_links_link_variant" DEFAULT 'link';
  ALTER TABLE "_pages_v_version_hero_links" ADD COLUMN "link_variant" "enum__pages_v_version_hero_links_link_variant" DEFAULT 'link';
  ALTER TABLE "_pages_v_blocks_cta_links" ADD COLUMN "link_variant" "enum__pages_v_blocks_cta_links_link_variant" DEFAULT 'link';
  UPDATE "pages_hero_links" SET "link_variant" = "link_appearance"::text::"enum_pages_hero_links_link_variant" WHERE "link_appearance" IS NOT NULL;
  UPDATE "pages_blocks_cta_links" SET "link_variant" = "link_appearance"::text::"enum_pages_blocks_cta_links_link_variant" WHERE "link_appearance" IS NOT NULL;
  UPDATE "_pages_v_version_hero_links" SET "link_variant" = "link_appearance"::text::"enum__pages_v_version_hero_links_link_variant" WHERE "link_appearance" IS NOT NULL;
  UPDATE "_pages_v_blocks_cta_links" SET "link_variant" = "link_appearance"::text::"enum__pages_v_blocks_cta_links_link_variant" WHERE "link_appearance" IS NOT NULL;
  ALTER TABLE "pages_hero_links" DROP COLUMN "link_appearance";
  ALTER TABLE "pages_blocks_cta_links" DROP COLUMN "link_appearance";
  ALTER TABLE "_pages_v_version_hero_links" DROP COLUMN "link_appearance";
  ALTER TABLE "_pages_v_blocks_cta_links" DROP COLUMN "link_appearance";
  DROP TYPE "public"."enum_pages_hero_links_link_appearance";
  DROP TYPE "public"."enum_pages_blocks_cta_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_version_hero_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_blocks_cta_links_link_appearance";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_hero_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_pages_blocks_cta_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__pages_v_version_hero_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_cta_links_link_appearance" AS ENUM('default', 'outline');
  ALTER TABLE "pages_hero_links" ADD COLUMN "link_appearance" "enum_pages_hero_links_link_appearance" DEFAULT 'default';
  ALTER TABLE "pages_blocks_cta_links" ADD COLUMN "link_appearance" "enum_pages_blocks_cta_links_link_appearance" DEFAULT 'default';
  ALTER TABLE "_pages_v_version_hero_links" ADD COLUMN "link_appearance" "enum__pages_v_version_hero_links_link_appearance" DEFAULT 'default';
  ALTER TABLE "_pages_v_blocks_cta_links" ADD COLUMN "link_appearance" "enum__pages_v_blocks_cta_links_link_appearance" DEFAULT 'default';
  UPDATE "pages_hero_links" SET "link_appearance" = "link_variant"::text::"enum_pages_hero_links_link_appearance" WHERE "link_variant" IN ('default', 'outline');
  UPDATE "pages_blocks_cta_links" SET "link_appearance" = "link_variant"::text::"enum_pages_blocks_cta_links_link_appearance" WHERE "link_variant" IN ('default', 'outline');
  UPDATE "_pages_v_version_hero_links" SET "link_appearance" = "link_variant"::text::"enum__pages_v_version_hero_links_link_appearance" WHERE "link_variant" IN ('default', 'outline');
  UPDATE "_pages_v_blocks_cta_links" SET "link_appearance" = "link_variant"::text::"enum__pages_v_blocks_cta_links_link_appearance" WHERE "link_variant" IN ('default', 'outline');
  ALTER TABLE "pages_hero_links" DROP COLUMN "link_variant";
  ALTER TABLE "pages_blocks_cta_links" DROP COLUMN "link_variant";
  ALTER TABLE "_pages_v_version_hero_links" DROP COLUMN "link_variant";
  ALTER TABLE "_pages_v_blocks_cta_links" DROP COLUMN "link_variant";
  DROP TYPE "public"."enum_pages_hero_links_link_variant";
  DROP TYPE "public"."enum_pages_blocks_cta_links_link_variant";
  DROP TYPE "public"."enum__pages_v_version_hero_links_link_variant";
  DROP TYPE "public"."enum__pages_v_blocks_cta_links_link_variant";`)
}
