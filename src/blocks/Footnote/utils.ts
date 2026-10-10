import type { FootnotesField } from "@/payload-types"

// useDocumentInfo()'s `data` is Payload's untyped admin form state (Record<string, any>),
// so this is the one place that trusts its `footnotes` key matches FootnotesField's shape.
export const getFootnotes = (
  data: Record<string, unknown> | undefined,
): NonNullable<FootnotesField> => (Array.isArray(data?.footnotes) ? data.footnotes : [])
