import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_comments_status" AS ENUM('published', 'hidden');
  CREATE TABLE "readers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"banned" boolean DEFAULT false,
  	"email_verified" boolean DEFAULT false,
  	"avatar_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" varchar NOT NULL,
  	"target_id" integer NOT NULL,
  	"reader_id" integer NOT NULL,
  	"status" "enum_comments_status" DEFAULT 'published' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reader_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"ip_address" varchar,
  	"user_agent" varchar,
  	"created_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "reader_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider_id" varchar NOT NULL,
  	"account_id" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"access_token" text,
  	"refresh_token" text,
  	"id_token" text,
  	"access_token_expires_at" timestamp(3) with time zone,
  	"refresh_token_expires_at" timestamp(3) with time zone,
  	"scope" varchar,
  	"password" varchar,
  	"created_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "reader_verifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"identifier" varchar NOT NULL,
  	"value" text NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"created_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "readers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comments_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "experiments_comments" boolean DEFAULT false;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_target_id_articles_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reader_sessions" ADD CONSTRAINT "reader_sessions_user_id_readers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reader_accounts" ADD CONSTRAINT "reader_accounts_user_id_readers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "readers_email_idx" ON "readers" USING btree ("email");
  CREATE INDEX "readers_updated_at_idx" ON "readers" USING btree ("updated_at");
  CREATE INDEX "readers_created_at_idx" ON "readers" USING btree ("created_at");
  CREATE INDEX "comments_target_idx" ON "comments" USING btree ("target_id");
  CREATE INDEX "comments_reader_idx" ON "comments" USING btree ("reader_id");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE UNIQUE INDEX "reader_sessions_token_idx" ON "reader_sessions" USING btree ("token");
  CREATE INDEX "reader_sessions_user_id_idx" ON "reader_sessions" USING btree ("user_id");
  CREATE UNIQUE INDEX "reader_accounts_provider_account_idx" ON "reader_accounts" USING btree ("provider_id","account_id");
  CREATE INDEX "reader_accounts_user_id_idx" ON "reader_accounts" USING btree ("user_id");
  CREATE INDEX "reader_verifications_identifier_idx" ON "reader_verifications" USING btree ("identifier");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_readers_fk" FOREIGN KEY ("readers_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_readers_id_idx" ON "payload_locked_documents_rels" USING btree ("readers_id");
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "readers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reader_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reader_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reader_verifications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "readers" CASCADE;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "reader_sessions" CASCADE;
  DROP TABLE "reader_accounts" CASCADE;
  DROP TABLE "reader_verifications" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_readers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comments_fk";
  
  DROP INDEX "payload_locked_documents_rels_readers_id_idx";
  DROP INDEX "payload_locked_documents_rels_comments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "readers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comments_id";
  ALTER TABLE "site_settings" DROP COLUMN "experiments_comments";
  DROP TYPE "public"."enum_comments_status";`)
}
