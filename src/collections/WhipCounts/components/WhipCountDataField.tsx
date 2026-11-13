"use client"

import { JSONField, useField } from "@payloadcms/ui"
import type { JSONFieldClientComponent } from "payload"
import React, { useState } from "react"

import {
  parseWhipCount,
  SEATS,
  stanceLabel,
  WHIP_COUNT_SCHEMA,
  type Seat,
  type Stance,
  type WhipCountData,
  type WhipCountMember,
} from "@/interactives/whip-count/model"

const cellInput: React.CSSProperties = {
  width: "100%",
  minWidth: "7rem",
  padding: "4px 6px",
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: 3,
  background: "var(--theme-input-bg)",
  color: "var(--theme-text)",
  font: "inherit",
}
const cell: React.CSSProperties = {
  padding: "4px 6px 4px 0",
  verticalAlign: "top",
  textAlign: "left",
}

/** A member's position as one choice: a stance, and the candidate it is about. */
const positionKey = (member: WhipCountMember): string =>
  member.candidate ? `${member.stance}:${member.candidate}` : member.stance

const EMPTY: WhipCountData = {
  schema: WHIP_COUNT_SCHEMA,
  asOf: new Date().toISOString().slice(0, 10),
  candidates: [],
  members: [],
}

/**
 * The whip count's `data` field as a table an editor fills in by hand: one row per voter,
 * with their position, the statement behind it and its source. "Edit as JSON" swaps the
 * table for Payload's JSON editor, to paste a whole count. Only one of the two is mounted at
 * a time, so each always starts from the field's current value.
 */
export const WhipCountDataField: JSONFieldClientComponent = (props) => {
  const { path, field, readOnly } = props
  const { value, setValue, showError, errorMessage } = useField<unknown>({ path })
  const [asJson, setAsJson] = useState(false)

  // What the table shows while it is being edited: the rows as typed. Reading them back
  // through `parseWhipCount` on every keystroke would trim a name's trailing space before the
  // next word, and refuse a row whose name is still empty.
  const [typed, setTyped] = useState<WhipCountData | null>(null)

  const parsed = parseWhipCount(value)
  const empty = value === undefined || value === null
  const data = typed ?? (parsed.success ? parsed.value : EMPTY)
  const fieldLabel = typeof field.label === "string" ? field.label : "Data"
  const write = (next: WhipCountData): void => {
    setTyped(next)
    setValue(next)
  }

  const setMember = (index: number, change: Partial<WhipCountMember>): void => {
    write({
      ...data,
      members: data.members.map((m, i) => (i === index ? { ...m, ...change } : m)),
    })
  }
  const setPosition = (index: number, key: string): void => {
    const [stance, candidate] = key.split(":") as [Stance, string | undefined]
    setMember(index, { stance, candidate })
  }
  const positions = [
    ...data.candidates.flatMap((c) =>
      (["backs", "leans", "opposes"] as const).map((stance) => ({
        key: `${stance}:${c.id}`,
        label: stanceLabel(stance, c),
      })),
    ),
    { key: "open", label: stanceLabel("open") },
    { key: "undeclared", label: stanceLabel("undeclared") },
  ]

  if (asJson || (!typed && !parsed.success && !empty) || data.candidates.length === 0) {
    return (
      <div>
        {!asJson && !empty && !parsed.success && (
          <p style={{ color: "var(--theme-error-500)" }}>
            This data can’t be shown as a table: {parsed.error}
          </p>
        )}
        <JSONField {...props} />
        {asJson && parsed.success && (
          <button
            type="button"
            className="btn btn--style-secondary btn--size-small"
            onClick={() => setAsJson(false)}
          >
            Edit as a table
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="field-type" data-whip-count-field="">
      <label className="field-label">{fieldLabel}</label>
      {showError && errorMessage && (
        <p style={{ color: "var(--theme-error-500)" }}>{errorMessage}</p>
      )}
      <p
        style={{
          margin: "0 0 8px",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <label>
          Checked on{" "}
          <input
            type="date"
            aria-label="Date the count was checked"
            style={{ ...cellInput, width: "auto" }}
            value={data.asOf}
            disabled={readOnly}
            onChange={(event) => write({ ...data, asOf: event.target.value })}
          />
        </label>
        <label>
          Vote held at{" "}
          <input
            aria-label="Time of the vote"
            placeholder="2026-12-01T09:30:00-05:00"
            style={{ ...cellInput, width: "16rem" }}
            value={data.voteAt ?? ""}
            disabled={readOnly}
            onChange={(event) => write({ ...data, voteAt: event.target.value || undefined })}
          />
        </label>
        <span>
          {data.members.length} people · {data.candidates.map((c) => c.name).join(" vs. ")}
        </span>
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {[
                "Name",
                "State",
                "Party",
                "Seat",
                "Bloc",
                "Tags",
                "Position",
                "What they said",
                "Said on",
                "Source link",
                "Note",
                "",
              ].map((heading) => (
                <th key={heading} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.members.map((member, index) => {
              const who = member.name || `row ${index + 1}`
              const textCell = (
                label: string,
                current: string | undefined,
                change: (next: string) => Partial<WhipCountMember>,
                style?: React.CSSProperties,
              ): React.ReactNode => (
                <td style={cell}>
                  <input
                    aria-label={`${label} for ${who}`}
                    style={{ ...cellInput, ...style }}
                    value={current ?? ""}
                    disabled={readOnly}
                    onChange={(event) => setMember(index, change(event.target.value))}
                  />
                </td>
              )
              return (
                // Rows are keyed by position: a name is editable, and two new rows have none.
                <tr key={index}>
                  {textCell("Name", member.name, (name) => ({ name }), { minWidth: "10rem" })}
                  {textCell("State", member.state, (state) => ({ state }), { minWidth: "3.5rem" })}
                  {textCell("Party", member.party, (party) => ({ party }), { minWidth: "3rem" })}
                  <td style={cell}>
                    <select
                      aria-label={`Seat for ${who}`}
                      style={cellInput}
                      value={member.seat}
                      disabled={readOnly}
                      onChange={(event) => setMember(index, { seat: event.target.value as Seat })}
                    >
                      {SEATS.map((seat) => (
                        <option key={seat} value={seat}>
                          {seat}
                        </option>
                      ))}
                    </select>
                  </td>
                  {textCell("Bloc", member.bloc, (bloc) => ({ bloc: bloc || undefined }))}
                  {textCell("Tags, separated by commas", member.tags?.join(","), (tags) => ({
                    tags: tags ? tags.split(",") : undefined,
                  }))}
                  <td style={cell}>
                    <select
                      aria-label={`Position for ${who}`}
                      style={{ ...cellInput, minWidth: "11rem" }}
                      value={positionKey(member)}
                      disabled={readOnly}
                      onChange={(event) => setPosition(index, event.target.value)}
                    >
                      {positions.map((position) => (
                        <option key={position.key} value={position.key}>
                          {position.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={cell}>
                    <textarea
                      aria-label={`What ${who} said`}
                      rows={2}
                      style={{ ...cellInput, minWidth: "18rem" }}
                      value={member.basis ?? ""}
                      disabled={readOnly}
                      onChange={(event) =>
                        setMember(index, { basis: event.target.value || undefined })
                      }
                    />
                  </td>
                  <td style={cell}>
                    <input
                      type="date"
                      aria-label={`Date ${who} said it`}
                      style={cellInput}
                      value={member.basisDate ?? ""}
                      disabled={readOnly}
                      onChange={(event) =>
                        setMember(index, { basisDate: event.target.value || undefined })
                      }
                    />
                  </td>
                  <td style={cell}>
                    <input
                      type="url"
                      aria-label={`Source link for ${who}`}
                      placeholder="https://"
                      style={{ ...cellInput, minWidth: "12rem" }}
                      value={member.source?.url ?? ""}
                      disabled={readOnly}
                      onChange={(event) =>
                        setMember(index, {
                          // The label is left for the save to work out from the link's site.
                          source: event.target.value
                            ? { url: event.target.value, label: "" }
                            : undefined,
                        })
                      }
                    />
                  </td>
                  {textCell("Note", member.note, (note) => ({ note: note || undefined }), {
                    minWidth: "12rem",
                  })}
                  <td style={cell}>
                    <button
                      type="button"
                      className="btn btn--style-secondary btn--size-small"
                      style={{ margin: 0 }}
                      aria-label={`Remove ${who}`}
                      disabled={readOnly}
                      onClick={() =>
                        write({ ...data, members: data.members.filter((_, i) => i !== index) })
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          style={{ margin: 0 }}
          disabled={readOnly}
          onClick={() =>
            write({
              ...data,
              members: [
                ...data.members,
                {
                  name: "",
                  state: "",
                  party: "D",
                  seat: "continuing",
                  stance: "undeclared",
                  voting: true,
                },
              ],
            })
          }
        >
          Add a person
        </button>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          style={{ margin: 0 }}
          onClick={() => {
            setTyped(null)
            setAsJson(true)
          }}
        >
          Edit as JSON
        </button>
      </p>
      {typeof field.admin?.description === "string" && (
        <div className="field-description">{field.admin.description}</div>
      )}
    </div>
  )
}
