import type { Field } from "payload"

/** Named fields of a group, looking through unnamed `row`s, keyed by name. */
export const namedFields = (fields: Field[]): Record<string, Field & { name: string }> => {
  const out: Record<string, Field & { name: string }> = {}
  for (const field of fields) {
    if ("name" in field) out[field.name] = field
    else if (field.type === "row") Object.assign(out, namedFields(field.fields))
  }
  return out
}

/** Calls a field's `admin.condition` with the given sibling data. */
export const showsFor = (field: Field, siblingData: Record<string, unknown>): boolean => {
  const condition = field.admin?.condition
  if (!condition) return true
  return Boolean(condition({}, siblingData, {} as never))
}
