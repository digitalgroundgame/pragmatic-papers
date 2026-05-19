"use client"

import RichText from "@/components/RichText"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"
import type { LexicalNode } from "../types"

interface FeedTableRowReflowProps {
  node: LexicalNode
}

function isColumnHeaderRow(row: LexicalNode): boolean {
  const cells = (row.children ?? []) as LexicalNode[]
  if (cells.length === 0) return false
  return cells.every((c) => {
    const hs = typeof c.headerState === "number" ? c.headerState : 0
    return (hs & 1) === 1
  })
}

function cellHasRowHeader(cell: LexicalNode): boolean {
  const hs = typeof cell.headerState === "number" ? cell.headerState : 0
  return (hs & 2) === 2
}

function cellToRoot(cell: LexicalNode): DefaultTypedEditorState {
  const children = Array.isArray(cell.children) ? (cell.children as LexicalNode[]) : []
  return {
    root: {
      type: "root",
      version: 1,
      children,
      direction: "ltr",
      format: "",
      indent: 0,
    },
  } as unknown as DefaultTypedEditorState
}

function cellPlainText(cell: LexicalNode): string {
  const collect = (n: LexicalNode): string => {
    if (n.type === "text" && typeof n.text === "string") return n.text
    const kids = Array.isArray(n.children) ? (n.children as LexicalNode[]) : []
    return kids.map(collect).join("")
  }
  return collect(cell).trim()
}

export function FeedTableRowReflow({ node }: FeedTableRowReflowProps): React.ReactNode {
  const rows = (Array.isArray(node.children) ? (node.children as LexicalNode[]) : []).filter(
    (r) => r.type === "tablerow",
  )
  if (rows.length === 0) return null

  // The header row (if any) supplies the labels for the reflowed cards.
  const headerRow = rows.find(isColumnHeaderRow)
  const bodyRows = rows.filter((r) => r !== headerRow)
  const headerLabels: string[] = headerRow
    ? ((headerRow.children ?? []) as LexicalNode[]).map(cellPlainText)
    : []

  return (
    <div className="space-y-3 overflow-y-auto" style={{ maxHeight: "100%" }}>
      {bodyRows.map((row, ri) => {
        const cells = (row.children ?? []) as LexicalNode[]
        const rowHeaderCell = cells.find(cellHasRowHeader)
        const dataCells = rowHeaderCell ? cells.filter((c) => c !== rowHeaderCell) : cells

        return (
          <article
            key={ri}
            className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-sm"
          >
            {rowHeaderCell && (
              <h3 className="font-display mb-2 text-lg text-white">
                {cellPlainText(rowHeaderCell)}
              </h3>
            )}
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
              {dataCells.map((cell, ci) => {
                const labelIndex = rowHeaderCell ? ci + 1 : ci
                const label = headerLabels[labelIndex] ?? `Column ${labelIndex + 1}`
                return (
                  <React.Fragment key={ci}>
                    <dt className="font-sans text-xs tracking-wide text-white/60 uppercase">
                      {label}
                    </dt>
                    <dd className="font-serif text-sm text-white/90 [&_p]:m-0">
                      <RichText data={cellToRoot(cell)} enableGutter={false} enableProse={false} />
                    </dd>
                  </React.Fragment>
                )
              })}
            </dl>
          </article>
        )
      })}
    </div>
  )
}
