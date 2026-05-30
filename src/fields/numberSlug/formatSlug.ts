import type { FieldHook } from "payload"

export const formatSlugHook =
  (_: string): FieldHook =>
  ({ data, operation, value }) => {
    if (typeof value === "number") {
      return value.toString()
    }

    if (operation === "create" || !data?.slug) {
      return "-1"
    }

    return value
  }
