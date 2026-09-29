"use client"

import { useState } from "react"

import type { MediaReference } from "../references/collectMediaReferences"
import { adminUrl, collectionLabel, fieldLabel } from "../references/labels"

const bodyText = { color: "var(--theme-text)", fontSize: "0.875rem", margin: 0 }
const mutedText = { color: "var(--theme-elevation-650)" }
const button = {
  background: "var(--theme-elevation-100)",
  border: "1px solid var(--theme-elevation-300)",
  borderRadius: "4px",
  color: "var(--theme-text)",
  cursor: "pointer",
  fontSize: "0.8125rem",
  padding: "0.25rem 0.625rem",
}

/** Detaches the media from one reference; rejects with the message to show. */
export type OnDetach = (reference: MediaReference) => Promise<void>

type RowState =
  { step: "idle" } | { step: "confirm" } | { step: "working" } | { step: "failed"; message: string }

function ReferenceRow({
  reference,
  onDetach,
}: {
  reference: MediaReference
  onDetach?: OnDetach
}): React.ReactNode {
  const [state, setState] = useState<RowState>({ step: "idle" })
  const where = `${collectionLabel(reference.collection).toLowerCase()} ${fieldLabel(reference.field)}`

  const detach = async (): Promise<void> => {
    if (!onDetach) return
    setState({ step: "working" })
    try {
      await onDetach(reference)
      // A successful detach removes this row, so there's no state to reset.
    } catch (error) {
      setState({ step: "failed", message: (error as Error).message })
    }
  }

  return (
    <li
      style={{
        backgroundColor: "var(--theme-elevation-50)",
        border: "1px solid var(--theme-elevation-200)",
        borderRadius: "4px",
        padding: "0.5rem 0.75rem",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <a
          href={adminUrl(reference)}
          style={{ fontSize: "0.875rem", fontWeight: 600, textDecoration: "underline" }}
          target="_blank"
          rel="noopener noreferrer"
        >
          {reference.docTitle}
        </a>
        <span style={{ ...mutedText, fontSize: "0.8125rem" }}>
          {collectionLabel(reference.collection)} &mdash; {fieldLabel(reference.field)}
        </span>
        {onDetach && (state.step === "idle" || state.step === "failed") && (
          <button
            type="button"
            style={{ ...button, marginLeft: "auto" }}
            aria-label={`Detach from ${reference.docTitle} (${fieldLabel(reference.field)})`}
            onClick={() => setState({ step: "confirm" })}
          >
            Detach
          </button>
        )}
      </div>

      {(state.step === "confirm" || state.step === "working") && (
        <div
          role="group"
          aria-label={`Confirm detaching from ${reference.docTitle}`}
          style={{ alignItems: "center", display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
        >
          <span style={{ ...bodyText, fontSize: "0.8125rem" }}>
            Remove it from the {where} and publish &ldquo;{reference.docTitle}&rdquo;?
          </span>
          <button
            type="button"
            style={button}
            disabled={state.step === "working"}
            onClick={() => void detach()}
          >
            {state.step === "working" ? "Publishing…" : "Detach and publish"}
          </button>
          <button
            type="button"
            style={button}
            disabled={state.step === "working"}
            onClick={() => setState({ step: "idle" })}
          >
            Cancel
          </button>
        </div>
      )}

      {state.step === "failed" && (
        <p role="alert" style={{ ...bodyText, fontSize: "0.8125rem", marginTop: "0.5rem" }}>
          {state.message}
        </p>
      )}
    </li>
  )
}

export function MediaReferenceList({
  references,
  loading,
  onDetach,
}: {
  references: MediaReference[]
  loading: boolean
  /** Shows a Detach button on each row. */
  onDetach?: OnDetach
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
          <ReferenceRow
            key={`${ref.collection}-${ref.docId}-${ref.field}`}
            reference={ref}
            onDetach={onDetach}
          />
        ))}
      </ul>
    </div>
  )
}
