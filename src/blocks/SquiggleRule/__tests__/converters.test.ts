// @vitest-environment node
import { describe, expect, it } from "vitest"

import { squiggleRuleToHTML } from "../converters"

describe("squiggleRuleToHTML", () => {
  it("renders a plain horizontal rule", () => {
    expect(squiggleRuleToHTML()).toMatchInlineSnapshot(`"<hr />"`)
  })
})
