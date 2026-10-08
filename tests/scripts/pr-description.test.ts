import { describe, expect, it } from "vitest"

import {
  blockEnd,
  BLOCKS,
  editPrBody,
  renderBlock,
  setPrLink,
  withBlock,
  withPrLink,
} from "../../scripts/pr-description"

const line = (...links: string[]) => `<!-- pr-links -->\n${links.join(" · ")}\n<!-- /pr-links -->`

describe("withBlock", () => {
  const blocks = Object.fromEntries(BLOCKS.map((name) => [name, renderBlock(name, name)]))

  it("puts each block under the ones above it, whatever order they arrive in", () => {
    let body = "## Context"
    for (const name of ["storybook-links", "pr-links", "showcase-links"] as const)
      body = withBlock(body, name, blocks[name]!)
    expect(body).toBe(BLOCKS.map((name) => blocks[name]).join("\n\n") + "\n\n## Context")
    body = "## Context"
    for (const name of ["pr-links", "storybook-links", "showcase-links"] as const)
      body = withBlock(body, name, blocks[name]!)
    expect(body).toBe(BLOCKS.map((name) => blocks[name]).join("\n\n") + "\n\n## Context")
  })

  it("replaces a block in place and removes it, leaving the others", () => {
    const body = `${blocks["showcase-links"]}\n\n${blocks["storybook-links"]}\n\nText`
    const next = renderBlock("storybook-links", "new")
    expect(withBlock(body, "storybook-links", next)).toBe(
      `${blocks["showcase-links"]}\n\n${next}\n\nText`,
    )
    expect(withBlock(body, "showcase-links", null)).toBe(`${blocks["storybook-links"]}\n\nText`)
    expect(blockEnd("pr-links")).toBe("<!-- /pr-links -->")
  })
})

describe("withPrLink", () => {
  const preview = "[Preview](https://pr-42.pragmaticpapers.com) at `aaaaaaa`"
  const coverage = "[Coverage](https://github.com/o/r/pull/42#issuecomment-1)"
  const shots = "[Screenshots](https://github.com/o/r/pull/42#issuecomment-2)"

  it("goes at the very top, above the Storybook links", () => {
    const body = "<!-- storybook-links -->\nS\n<!-- /storybook-links -->\n\n## Context"
    expect(withPrLink(body, "Preview", preview)).toBe(`${line(preview)}\n\n${body}`)
  })

  it("goes under any Closes lines, and fills an empty description", () => {
    expect(withPrLink("Closes #743\n\nText", "Preview", preview)).toBe(
      `Closes #743\n\n${line(preview)}\n\nText`,
    )
    expect(withPrLink("", "Coverage", coverage)).toBe(`${line(coverage)}\n`)
  })

  it("goes under the template's unfilled Closes line too", () => {
    expect(withPrLink("Closes #\n\n## Context", "Preview", preview)).toBe(
      `Closes #\n\n${line(preview)}\n\n## Context`,
    )
  })

  it("keeps the other jobs' links, in a fixed order", () => {
    const body = `${line(shots)}\n\nText`
    const both = withPrLink(body, "Coverage", coverage)
    expect(both).toBe(`${line(coverage, shots)}\n\nText`)
    expect(withPrLink(both, "Preview", preview)).toBe(`${line(preview, coverage, shots)}\n\nText`)
  })

  it("replaces its own link in place, and is idempotent", () => {
    const old = "[Preview](https://pr-42.pragmaticpapers.com) at `bbbbbbb`"
    const body = `Closes #1\n\n${line(old, coverage)}\n\nText`
    const next = withPrLink(body, "Preview", preview)
    expect(next).toBe(`Closes #1\n\n${line(preview, coverage)}\n\nText`)
    expect(withPrLink(next, "Preview", preview)).toBe(next)
  })

  it("goes under the showcase links, without the Preview link they stand in for", () => {
    const showcase = "<!-- showcase-links -->\nShowcase: [A](u)\n<!-- /showcase-links -->"
    expect(withPrLink(`${showcase}\n\nText`, "Preview", preview)).toBe(`${showcase}\n\nText`)
    expect(withPrLink(`${showcase}\n\nText`, "Coverage", coverage)).toBe(
      `${showcase}\n\n${line(coverage)}\n\nText`,
    )
    expect(withPrLink(`${showcase}\n\n${line(preview, coverage)}`, "Coverage", coverage)).toBe(
      `${showcase}\n\n${line(coverage)}`,
    )
  })

  it("removes its link, and the line once it's empty", () => {
    expect(withPrLink(`${line(preview, coverage)}\n\nText`, "Preview", null)).toBe(
      `${line(coverage)}\n\nText`,
    )
    expect(withPrLink(`Closes #1\n\n${line(preview)}\n\nText`, "Preview", null)).toBe(
      "Closes #1\n\nText",
    )
    expect(withPrLink("Text", "Preview", null)).toBe("Text")
  })
})

describe("editPrBody and setPrLink", () => {
  const target = { repo: "o/r", prNumber: 42, token: "t" }
  const coverage = "[Coverage](u)"

  function fakePr(body: string, rewrites: string[] = []) {
    const patches: string[] = []
    const logs: string[] = []
    const deps = {
      fetch: (async (_url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          body = JSON.parse(init.body as string).body
          patches.push(body)
          // Another job's edit lands after this one, without this link.
          body = rewrites.shift() ?? body
          return new Response("{}")
        }
        return new Response(JSON.stringify({ body }))
      }) as typeof fetch,
      log: (message: string) => logs.push(message),
      sleep: async () => undefined,
    }
    return { deps, patches, logs }
  }

  it("writes again when another job's edit replaced its link", async () => {
    const pr = fakePr("Text", ["Other text"])
    await setPrLink(target, "Coverage", coverage, pr.deps)
    expect(pr.patches).toEqual([`${line(coverage)}\n\nText`, `${line(coverage)}\n\nOther text`])
  })

  it("gives up with a warning when other jobs keep rewriting it", async () => {
    const pr = fakePr("Text", ["A", "B", "C"])
    await setPrLink(target, "Coverage", coverage, pr.deps)
    expect(pr.patches).toHaveLength(3)
    expect(pr.logs.join("\n")).toContain("::warning::")
  })

  it("writes nothing when the link is already there", async () => {
    const pr = fakePr(`${line(coverage)}\n\nText`)
    await setPrLink(target, "Coverage", coverage, pr.deps)
    expect(pr.patches).toEqual([])
  })

  it("warns, and returns null, when GitHub refuses the edit", async () => {
    const logs: string[] = []
    const deps = {
      fetch: (async () => new Response("Not Found", { status: 404 })) as typeof fetch,
      log: (message: string) => logs.push(message),
      sleep: async () => undefined,
    }
    expect(await editPrBody(target, (body) => `${body}!`, "test block", deps)).toBeNull()
    expect(logs).toEqual([
      "::warning::Couldn't update the test block in the PR's description: GET https://api.github.com/repos/o/r/pulls/42 → 404: Not Found",
    ])
  })
})
