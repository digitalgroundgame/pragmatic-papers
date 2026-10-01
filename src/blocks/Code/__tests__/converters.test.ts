// @vitest-environment node
import { describe, expect, it } from "vitest"

import { codeBlock } from "@/stories/fixtures/blocks"

import { codeToHTML } from "../converters"

describe("codeToHTML", () => {
  it("renders the code escaped in pre/code", () => {
    expect(codeToHTML(codeBlock)).toMatchInlineSnapshot(`
      "<pre tabindex="0"><code>export function turnout(ballots: number, registered: number): string {
        if (registered === 0) return &quot;n/a&quot;
        return \`\${((ballots / registered) * 100).toFixed(1)}%\`
      }</code></pre>"
    `)
  })

  it("escapes markup in the code", () => {
    expect(codeToHTML({ code: "<div>&</div>" })).toMatchInlineSnapshot(
      `"<pre tabindex="0"><code>&lt;div&gt;&amp;&lt;/div&gt;</code></pre>"`,
    )
  })

  it("renders nothing for an empty block", () => {
    expect(codeToHTML({ code: "" })).toBe("")
  })
})
