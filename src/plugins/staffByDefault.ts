import type { Access, Plugin } from "payload"

import { isStaff } from "@/access/roles"
import type { User } from "@/payload-types"

const staff: Access = ({ req: { user } }) => isStaff(user as User | null)

const OPERATIONS = ["create", "read", "update", "delete"] as const

function withDefaults<T extends object>(operations: readonly string[], access: T | undefined): T {
  const given = Object.entries(access ?? {}).filter(([, rule]) => rule !== undefined)
  return {
    ...Object.fromEntries(operations.map((op) => [op, staff])),
    ...Object.fromEntries(given),
  } as T
}

/**
 * Gives every operation a collection or global leaves without a rule to staff only.
 *
 * Payload lets any logged-in user do whatever has no rule, and plugins leave plenty without
 * one (redirects, forms, the search index). Only staff become Payload's logged-in user today
 * (`isPayloadUser` in `signIn.ts`), so this changes nothing for anyone now; it keeps a rule
 * someone forgets from reaching members if that ever changes. Runs after every other plugin,
 * so it sees their collections. Payload's own (preferences, locked documents, migrations) are
 * added after plugins and keep their defaults.
 */
export const staffByDefault: Plugin = (config) => ({
  ...config,
  collections: config.collections?.map((collection) => ({
    ...collection,
    access: withDefaults(OPERATIONS, collection.access),
  })),
  globals: config.globals?.map((global) => ({
    ...global,
    access: withDefaults(["read", "update"], global.access),
  })),
})
