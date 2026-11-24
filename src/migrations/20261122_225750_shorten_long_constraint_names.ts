import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_interactive_snapshots_v" DROP CONSTRAINT "_interactive_snapshots_v_version_interactive_id_interactives_id_fk";
  
  ALTER TABLE "_interactive_snapshots_v" ADD CONSTRAINT "_interactive_snapshots_v_version_interactive_id_int_cfbe46b3_fk" FOREIGN KEY ("version_interactive_id") REFERENCES "public"."interactives"("id") ON DELETE set null ON UPDATE no action;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_interactive_snapshots_v" DROP CONSTRAINT "_interactive_snapshots_v_version_interactive_id_int_cfbe46b3_fk";
  
  ALTER TABLE "_interactive_snapshots_v" ADD CONSTRAINT "_interactive_snapshots_v_version_interactive_id_interactives_id_fk" FOREIGN KEY ("version_interactive_id") REFERENCES "public"."interactives"("id") ON DELETE set null ON UPDATE no action;`)
}
