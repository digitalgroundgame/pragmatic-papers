import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import { TableOfContents, TableOfContentsProvider } from ".."

function makeState(children: unknown[]): DefaultTypedEditorState {
  return {
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as DefaultTypedEditorState
}

function socialEmbed(fields: Record<string, unknown>) {
  return { type: "block", fields: { blockType: "socialEmbed", ...fields } } as object
}

describe("app TOC instance — socialEmbed resolver", () => {
  it.each([
    ["bluesky", "Bluesky embed"],
    ["reddit", "Reddit embed"],
    ["tiktok", "TikTok embed"],
    ["twitter", "Twitter embed"],
    ["youtube", "YouTube embed"],
  ])("labels %s as %s", (platform, expected) => {
    const state = makeState([socialEmbed({ id: "e1", platform })])
    const { getByText } = render(
      <TableOfContentsProvider content={state}>
        <TableOfContents />
      </TableOfContentsProvider>,
    )
    expect(getByText(expected)).toBeTruthy()
  })

  it("uses 'Social embed' fallback when platform is missing", () => {
    const state = makeState([socialEmbed({ id: "e1" })])
    const { getByText } = render(
      <TableOfContentsProvider content={state}>
        <TableOfContents />
      </TableOfContentsProvider>,
    )
    expect(getByText("Social embed")).toBeTruthy()
  })

  it("skips embeds with no id (no anchor target)", () => {
    const state = makeState([socialEmbed({ platform: "twitter" })])
    const { container } = render(
      <TableOfContentsProvider content={state}>
        <TableOfContents />
      </TableOfContentsProvider>,
    )
    expect(container.firstChild).toBeNull()
  })

  it("anchors to the embed's id", () => {
    const state = makeState([socialEmbed({ id: "embed-42", platform: "youtube" })])
    const { container } = render(
      <TableOfContentsProvider content={state}>
        <TableOfContents />
      </TableOfContentsProvider>,
    )
    const link = container.querySelector('a[href="#embed-42"]')
    expect(link).toBeTruthy()
  })

  it("renders the TvIcon next to the label", () => {
    const state = makeState([socialEmbed({ id: "e1", platform: "twitter" })])
    const { container } = render(
      <TableOfContentsProvider content={state}>
        <TableOfContents />
      </TableOfContentsProvider>,
    )
    expect(container.querySelector("svg")).toBeTruthy()
  })
})
