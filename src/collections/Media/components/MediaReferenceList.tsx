import type { MediaReference } from "../references/collectMediaReferences"

function collectionLabel(collection: string): string {
  return collection.charAt(0).toUpperCase() + collection.slice(1)
}

const bodyText = { color: "var(--theme-text)", fontSize: "0.875rem", margin: 0 }
const mutedText = { color: "var(--theme-elevation-650)" }

export function MediaReferenceList({
  references,
  loading,
}: {
  references: MediaReference[]
  loading: boolean
}): React.ReactNode {
  if (loading) {
    return (
      <p role="status" style={{ ...bodyText, marginBottom: "1rem" }}>
        Checking references…
      </p>
    )
  }

  if (references.length === 0) {
    return (
      <div
        style={{
          border: "1px solid var(--theme-elevation-200)",
          borderRadius: "4px",
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
        }}
      >
        <p style={bodyText}>Not referenced in any published documents.</p>
      </div>
    )
  }

  return (
    <div>
      <p style={{ ...mutedText, fontSize: "1rem", margin: "0 0 0.75rem" }}>
        This media is referenced by the following published documents. You cannot delete it while it
        remains in use.
      </p>
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {references.map((ref) => (
          <li
            key={`${ref.collection}-${ref.docId}-${ref.field}`}
            style={{
              backgroundColor: "var(--theme-elevation-50)",
              border: "1px solid var(--theme-elevation-200)",
              borderRadius: "4px",
              padding: "0.5rem 0.75rem",
            }}
          >
            <a
              href={`/admin/collections/${ref.collection}/${ref.docId}`}
              style={{ fontSize: "0.875rem", fontWeight: 600, textDecoration: "underline" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ref.docTitle}
            </a>
            <span style={{ ...mutedText, fontSize: "0.8125rem", marginLeft: "0.5rem" }}>
              {collectionLabel(ref.collection)} &mdash; {ref.field}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
