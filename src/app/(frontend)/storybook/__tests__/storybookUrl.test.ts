import { describe, expect, it } from "vitest"
import { storybookUrl } from "../storybookUrl"

describe("storybookUrl", () => {
  it("sends a PR preview to that PR's preview alias", () => {
    expect(storybookUrl("pr-330.pragmaticpapers.com")).toBe(
      "https://pr-330-pragmatic-papers-storybook.digital-ground-game.workers.dev",
    )
  })

  it("sends staging, local dev and unknown hosts to the main address", () => {
    for (const host of ["staging.pragmaticpapers.com", "localhost:8000", "", null, undefined]) {
      expect(storybookUrl(host)).toBe(
        "https://pragmatic-papers-storybook.digital-ground-game.workers.dev",
      )
    }
  })

  it("only takes a PR number from the start of the host", () => {
    expect(storybookUrl("evil.com.pr-1.pragmaticpapers.com")).toBe(
      "https://pragmatic-papers-storybook.digital-ground-game.workers.dev",
    )
    expect(storybookUrl("pr-abc.pragmaticpapers.com")).toBe(
      "https://pragmatic-papers-storybook.digital-ground-game.workers.dev",
    )
  })
})
