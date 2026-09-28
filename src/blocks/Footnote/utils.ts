import type { FootnotesField } from "@/payload-types"

export const truncate = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, limit)}…` : text

// useDocumentInfo()'s `data` is Payload's untyped admin form state (Record<string, any>),
// so this is the one place that trusts its `footnotes` key matches FootnotesField's shape.
export const getFootnotes = (
  data: Record<string, unknown> | undefined,
): NonNullable<FootnotesField> => (Array.isArray(data?.footnotes) ? data.footnotes : [])
