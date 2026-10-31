import type { PostgresAdapterArgs } from "@payloadcms/db-postgres"
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "@payloadcms/db-postgres/drizzle/pg-core"

import { TABLES } from "./constants"

type SchemaHook = NonNullable<PostgresAdapterArgs["afterSchemaInit"]>[number]

const date = (name: string) => timestamp(name, { mode: "string", withTimezone: true, precision: 3 })

/**
 * Better Auth's sessions, linked provider accounts and short-lived verification values (the
 * OAuth state), as plain tables beside Payload's. They aren't collections: nothing in the
 * admin lists them, and Better Auth reads and writes them itself. Declared here so Payload's
 * schema knows them: dev's push leaves them alone and `payload migrate:create` writes their
 * DDL. `usersSlug` is the plugin's option of the same name.
 */
export function ssoAfterSchemaInit(usersSlug = "users"): SchemaHook {
  return ({ schema }) => {
    const users = schema.tables[usersSlug]
    if (!users) return schema

    const userId = () =>
      integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" })

    return {
      ...schema,
      tables: {
        ...schema.tables,
        [TABLES.session]: pgTable(
          TABLES.session,
          {
            id: serial("id").primaryKey(),
            token: varchar("token").notNull(),
            user_id: userId(),
            expires_at: date("expires_at").notNull(),
            ip_address: varchar("ip_address"),
            user_agent: varchar("user_agent"),
            created_at: date("created_at").notNull(),
            updated_at: date("updated_at").notNull(),
          },
          (t) => [
            uniqueIndex(`${TABLES.session}_token_idx`).on(t.token),
            index(`${TABLES.session}_user_id_idx`).on(t.user_id),
          ],
        ),
        [TABLES.account]: pgTable(
          TABLES.account,
          {
            id: serial("id").primaryKey(),
            provider_id: varchar("provider_id").notNull(),
            account_id: varchar("account_id").notNull(),
            user_id: userId(),
            access_token: text("access_token"),
            refresh_token: text("refresh_token"),
            id_token: text("id_token"),
            access_token_expires_at: date("access_token_expires_at"),
            refresh_token_expires_at: date("refresh_token_expires_at"),
            scope: varchar("scope"),
            password: varchar("password"),
            created_at: date("created_at").notNull(),
            updated_at: date("updated_at").notNull(),
          },
          (t) => [
            uniqueIndex(`${TABLES.account}_provider_account_idx`).on(t.provider_id, t.account_id),
            index(`${TABLES.account}_user_id_idx`).on(t.user_id),
          ],
        ),
        [TABLES.verification]: pgTable(
          TABLES.verification,
          {
            id: serial("id").primaryKey(),
            identifier: varchar("identifier").notNull(),
            value: text("value").notNull(),
            expires_at: date("expires_at").notNull(),
            created_at: date("created_at").notNull(),
            updated_at: date("updated_at").notNull(),
          },
          (t) => [index(`${TABLES.verification}_identifier_idx`).on(t.identifier)],
        ),
      },
    }
  }
}
