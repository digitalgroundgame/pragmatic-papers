import { getTableConfig, pgTable, serial } from "@payloadcms/db-postgres/drizzle/pg-core"
import { describe, expect, it } from "vitest"

import { ssoAfterSchemaInit } from "../schema"

type Schema = Parameters<ReturnType<typeof ssoAfterSchemaInit>>[0]["schema"]

const users = pgTable("users", { id: serial("id").primaryKey() })
const schemaWith = (tables: Record<string, unknown>) => ({ tables }) as unknown as Schema
const run = (schema: Schema, usersSlug?: string) =>
  ssoAfterSchemaInit(usersSlug)({ schema } as Parameters<ReturnType<typeof ssoAfterSchemaInit>>[0])

describe("ssoAfterSchemaInit", () => {
  it("adds Better Auth's three tables beside Payload's", async () => {
    const schema = await run(schemaWith({ users }))
    expect(Object.keys(schema.tables)).toEqual([
      "users",
      "auth_sessions",
      "auth_accounts",
      "auth_verifications",
    ])
  })

  it("ties sessions and accounts to their user, deleted with it", async () => {
    const schema = await run(schemaWith({ users }))
    for (const name of ["auth_sessions", "auth_accounts"]) {
      const [foreignKey] = getTableConfig(schema.tables[name] as typeof users).foreignKeys
      const reference = foreignKey!.reference()
      expect(reference.columns.map((column) => column.name)).toEqual(["user_id"])
      expect(reference.foreignTable).toBe(users)
      expect(foreignKey!.onDelete).toBe("cascade")
    }
  })

  it("looks up a session by its token and an account by its provider id, uniquely", async () => {
    const schema = await run(schemaWith({ users }))
    const unique = (name: string) =>
      getTableConfig(schema.tables[name] as typeof users)
        .indexes.filter(({ config }) => config.unique)
        .map(({ config }) => config.columns.map((column) => ("name" in column ? column.name : "")))

    expect(unique("auth_sessions")).toEqual([["token"]])
    expect(unique("auth_accounts")).toEqual([["provider_id", "account_id"]])
  })

  it("references the collection named by usersSlug", async () => {
    const staff = pgTable("staff", { id: serial("id").primaryKey() })
    const schema = await run(schemaWith({ staff }), "staff")
    const [foreignKey] = getTableConfig(schema.tables.auth_sessions as typeof users).foreignKeys
    expect(foreignKey!.reference().foreignTable).toBe(staff)
  })

  it("leaves a schema without the users table alone", async () => {
    const schema = schemaWith({ articles: users })
    expect(await run(schema)).toBe(schema)
  })
})
