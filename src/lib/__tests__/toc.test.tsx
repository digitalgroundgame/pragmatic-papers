import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { toc } from "../toc"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"

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
    const { getByText } = render(<toc.Component content={state} />)
    expect(getByText(expected)).toBeTruthy()
  })

  it("uses 'Social embed' fallback when platform is missing", () => {
    const state = makeState([socialEmbed({ id: "e1" })])
    const { getByText } = render(<toc.Component content={state} />)
    expect(getByText("Social embed")).toBeTruthy()
  })

  it("skips embeds with no id (no anchor target)", () => {
    const state = makeState([socialEmbed({ platform: "twitter" })])
    const { container } = render(<toc.Component content={state} />)
    expect(container.firstChild).toBeNull()
  })

  it("anchors to the embed's id", () => {
    const state = makeState([socialEmbed({ id: "embed-42", platform: "youtube" })])
    const { container } = render(<toc.Component content={state} />)
    expect(container.querySelector("a")?.getAttribute("href")).toBe("#embed-42")
  })

  it("renders the TvIcon next to the label", () => {
    const state = makeState([socialEmbed({ id: "e1", platform: "twitter" })])
    const { container } = render(<toc.Component content={state} />)
    expect(container.querySelector("svg")).toBeTruthy()
  })
})
