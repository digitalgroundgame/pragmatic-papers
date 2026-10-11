import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "auth_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"ip_address" varchar,
  	"user_agent" varchar,
  	"created_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "auth_accounts" (
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
  
  CREATE TABLE "auth_verifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"identifier" varchar NOT NULL,
  	"value" text NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"created_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "experiments_sso" boolean DEFAULT false;
  ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "auth_sessions_token_idx" ON "auth_sessions" USING btree ("token");
  CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");
  CREATE UNIQUE INDEX "auth_accounts_provider_account_idx" ON "auth_accounts" USING btree ("provider_id","account_id");
  CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts" USING btree ("user_id");
  CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "auth_sessions" CASCADE;
  DROP TABLE "auth_accounts" CASCADE;
  DROP TABLE "auth_verifications" CASCADE;
  ALTER TABLE "users" DROP COLUMN "email_verified";
  ALTER TABLE "site_settings" DROP COLUMN "experiments_sso";`)
}
