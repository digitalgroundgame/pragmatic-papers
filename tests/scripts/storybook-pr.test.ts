import { describe, expect, it } from "vitest"

import {
  changedComponents,
  type Deps,
  ENVIRONMENT,
  type IndexEntry,
  LINKS_END,
  LINKS_START,
  linksBlock,
  main,
  MAX_COMPONENTS,
  withStorybookLinks,
} from "../../scripts/storybook-pr"

const SHOWCASE_LINKS_END = "<!-- /showcase-links -->"
const PR_LINKS_END = "<!-- /pr-links -->"

const URL = "https://pr-42-pragmatic-papers-storybook.example.workers.dev"

/** A component's docs page and one story, as the build's index.json lists them. */
const component = (title: string, storyFile: string, componentFile: string): IndexEntry[] => {
  const id = title.toLowerCase().replace(/\//g, "-")
  return [
    { id: `${id}--docs`, title, type: "docs", importPath: `./${storyFile}` },
    {
      id: `${id}--default`,
      title,
      type: "story",
      importPath: `./${storyFile}`,
      componentPath: `./${componentFile}`,
    },
  ]
}

const ENTRIES: IndexEntry[] = [
  ...component(
    "Blocks/Banner",
    "src/blocks/Banner/Banner.stories.tsx",
    "src/blocks/Banner/Component.tsx",
  ),
  ...component(
    "Components/Media",
    "src/components/Media/Media.stories.tsx",
    "src/components/Media/index.tsx",
  ),
  ...component("UI/Button", "src/components/ui/button.stories.tsx", "src/components/ui/button.tsx"),
  ...component("UI/Card", "src/components/ui/card.stories.tsx", "src/components/ui/card.tsx"),
  ...component("UI/Dialog", "src/components/ui/dialog.stories.tsx", "src/components/ui/dialog.tsx"),
  ...component("UI/Select", "src/components/ui/select.stories.tsx", "src/components/ui/select.tsx"),
  // A story without a docs page.
  {
    id: "layout-header--default",
    title: "Layout/Header",
    type: "story",
    importPath: "./src/Header/Header.stories.tsx",
    componentPath: "./src/Header/Component.tsx",
  },
]

const titles = (files: string[]) => changedComponents(files, ENTRIES).map((c) => c.title)

describe("changedComponents", () => {
  it("matches a changed component or story file", () => {
    expect(titles(["src/components/ui/button.tsx"])).toEqual(["UI/Button"])
    expect(titles(["src/components/ui/card.stories.tsx"])).toEqual(["UI/Card"])
  })

  it("matches a file in a component's folder or below it", () => {
    expect(titles(["src/blocks/Banner/config.ts"])).toEqual(["Blocks/Banner"])
    expect(titles(["src/components/Media/ImageMedia/index.tsx"])).toEqual(["Components/Media"])
  })

  it("doesn't match a whole folder of primitives by folder alone", () => {
    expect(titles(["src/components/ui/utils.ts"])).toEqual([])
  })

  it("ignores tests, generated files and anything outside src/", () => {
    expect(
      titles([
        "src/components/Media/__tests__/Media.test.tsx",
        "src/payload-types.ts",
        "src/migrations/20260101_x.ts",
        ".github/workflows/ci.yml",
        "tests/e2e/banner.spec.ts",
      ]),
    ).toEqual([])
  })

  it("lists each component once, sorted, linking its docs page or else its first story", () => {
    expect(
      changedComponents(
        [
          "src/Header/Component.tsx",
          "src/components/ui/button.tsx",
          "src/components/ui/button.stories.tsx",
        ],
        ENTRIES,
      ),
    ).toEqual([
      { title: "Layout/Header", id: "layout-header--default", type: "story" },
      { title: "UI/Button", id: "ui-button--docs", type: "docs" },
    ])
  })
})

describe("linksBlock", () => {
  it("is null when no component changed", () => {
    expect(linksBlock(URL, [])).toBeNull()
  })

  it("links each changed component's docs page or story", () => {
    expect(
      linksBlock(`${URL}/`, [
        { title: "Layout/Header", id: "layout-header--default", type: "story" },
        { title: "UI/Button", id: "ui-button--docs", type: "docs" },
      ]),
    ).toBe(
      [
        LINKS_START,
        "**Storybook** — components this PR changes:",
        `- [Layout/Header](${URL}/?path=/story/layout-header--default)`,
        `- [UI/Button](${URL}/?path=/docs/ui-button--docs)`,
        LINKS_END,
      ].join("\n"),
    )
  })

  it("summarises components past the limit", () => {
    const many = Array.from({ length: MAX_COMPONENTS + 3 }, (_, i) => ({
      title: `C/${i}`,
      id: `c-${i}--docs`,
      type: "docs" as const,
    }))
    const block = linksBlock(URL, many)!
    expect(block.match(/^- \[/gm)).toHaveLength(MAX_COMPONENTS)
    expect(block).toContain("- …and 3 more")
  })
})

describe("withStorybookLinks", () => {
  const block = linksBlock(URL, [{ title: "UI/Button", id: "ui-button--docs", type: "docs" }])!
  const old = `${LINKS_START}\n**Storybook:** old\n${LINKS_END}`
  const showcase = `<!-- showcase-links -->\n**On the preview:**\n\n- [first](u)\n${SHOWCASE_LINKS_END}`

  it("adds the block at the top, under the issues the PR closes", () => {
    expect(withStorybookLinks("## Context\n\nText\n", block)).toBe(
      `${block}\n\n## Context\n\nText\n`,
    )
    expect(withStorybookLinks("Closes #743\n\n## Context", block)).toBe(
      `Closes #743\n\n${block}\n\n## Context`,
    )
    expect(withStorybookLinks("Closes #\n\n## Context", block)).toBe(
      `Closes #\n\n${block}\n\n## Context`,
    )
    expect(withStorybookLinks("", block)).toBe(`${block}\n`)
  })

  it("adds the block under the showcase links", () => {
    expect(withStorybookLinks(`Closes #1\n\n${showcase}\n\n## Context`, block)).toBe(
      `Closes #1\n\n${showcase}\n\n${block}\n\n## Context`,
    )
    expect(withStorybookLinks(showcase, block)).toBe(`${showcase}\n\n${block}\n`)
  })

  it("adds the block under the links line, which sits under any showcase links", () => {
    const links = `<!-- pr-links -->\n[Preview](p)\n${PR_LINKS_END}`
    expect(withStorybookLinks(`Closes #1\n\n${links}\n\n## Context`, block)).toBe(
      `Closes #1\n\n${links}\n\n${block}\n\n## Context`,
    )
    expect(withStorybookLinks(`${showcase}\n\n${links}\n\nText`, block)).toBe(
      `${showcase}\n\n${links}\n\n${block}\n\nText`,
    )
  })

  it("replaces the block in place, leaving the rest untouched", () => {
    const body = `${showcase}\n\n${old}\r\n\r\n## Context\r\n`
    expect(withStorybookLinks(body, block)).toBe(`${showcase}\n\n${block}\r\n\r\n## Context\r\n`)
  })

  it("removes the block when no component changed", () => {
    expect(withStorybookLinks(`${old}\n\n## Context\n\nText\n`, null)).toBe("## Context\n\nText\n")
    expect(withStorybookLinks(`Closes #1\n\n${old}\n\n## B`, null)).toBe("Closes #1\n\n## B")
    expect(withStorybookLinks("## Context\n", null)).toBe("## Context\n")
  })
})

describe("main", () => {
  const ENV = {
    GITHUB_REPOSITORY: "digitalgroundgame/pragmatic-papers",
    GITHUB_TOKEN: "gh-token",
    PR_NUMBER: "42",
    PREVIEW_URL: URL,
    INDEX_FILE: "index.json",
  }

  /** `rewrites`: what another job writes over the description after each of ours. */
  function fakeDeps(
    files: { filename: string; status: string }[],
    body: string,
    rewrites: string[] = [],
  ) {
    const calls: { method: string; url: string; body?: unknown }[] = []
    const logs: string[] = []
    const deps: Deps = {
      fetch: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? "GET"
        const sent = init?.body ? JSON.parse(String(init.body)) : undefined
        calls.push({ method, url, body: sent })
        if (method === "PATCH") body = rewrites.shift() ?? (sent as { body: string }).body
        const payload = url.includes("/files?")
          ? files
          : url.includes("/deployments?")
            ? [{ id: 7 }, { id: 8 }]
            : url.endsWith("/deployments")
              ? { id: 8 }
              : { body, head: { ref: "feat/thing" } }
        return new Response(JSON.stringify(payload), { status: 200 })
      }) as typeof fetch,
      log: (message) => logs.push(message),
      summary: (markdown) => logs.push(markdown),
      readFile: () =>
        JSON.stringify({ v: 5, entries: Object.fromEntries(ENTRIES.map((e) => [e.id, e])) }),
      sleep: () => Promise.resolve(),
    }
    return { deps, calls, logs }
  }

  it("records the preview as a Deployment and retires the PR's older ones", async () => {
    const { deps, calls } = fakeDeps([], "")
    expect(await main(["deploy"], ENV, deps)).toBe(0)
    const posts = calls.filter((call) => call.method === "POST")
    const api = "https://api.github.com/repos/digitalgroundgame/pragmatic-papers"
    expect(posts[0]).toMatchObject({
      url: `${api}/deployments`,
      body: { ref: "feat/thing", environment: ENVIRONMENT, required_contexts: [] },
    })
    expect(posts.slice(1)).toEqual([
      {
        method: "POST",
        url: `${api}/deployments/8/statuses`,
        body: {
          state: "success",
          environment: ENVIRONMENT,
          environment_url: URL,
          auto_inactive: false,
        },
      },
      {
        method: "POST",
        url: `${api}/deployments/7/statuses`,
        body: { state: "inactive", environment: ENVIRONMENT, auto_inactive: false },
      },
    ])
  })

  it("retires all of the PR's Deployments when it closes", async () => {
    const { deps, calls } = fakeDeps([], "")
    expect(await main(["close"], { ...ENV, PREVIEW_URL: "" }, deps)).toBe(0)
    const api = "https://api.github.com/repos/digitalgroundgame/pragmatic-papers"
    expect(calls.filter((call) => call.method === "POST")).toEqual(
      [7, 8].map((id) => ({
        method: "POST",
        url: `${api}/deployments/${id}/statuses`,
        body: { state: "inactive", environment: ENVIRONMENT, auto_inactive: false },
      })),
    )
    expect(calls[1]?.url).toBe(
      `${api}/deployments?environment=Storybook&ref=feat%2Fthing&per_page=100`,
    )
  })

  it("links the changed components at the top of the description", async () => {
    const { deps, calls } = fakeDeps(
      [
        { filename: "src/components/ui/button.tsx", status: "modified" },
        { filename: "src/components/ui/card.tsx", status: "removed" },
      ],
      "## Context\n\nText",
    )
    expect(await main(["link"], ENV, deps)).toBe(0)
    const patch = calls.find((call) => call.method === "PATCH")
    expect(patch?.url).toBe(
      "https://api.github.com/repos/digitalgroundgame/pragmatic-papers/pulls/42",
    )
    expect(patch?.body).toEqual({
      body: `${linksBlock(URL, [{ title: "UI/Button", id: "ui-button--docs", type: "docs" }])}\n\n## Context\n\nText`,
    })
  })

  it("writes again when another job's edit replaced its links", async () => {
    const files = [{ filename: "src/components/ui/button.tsx", status: "modified" }]
    const { deps, calls, logs } = fakeDeps(files, "## Context", ["Closes #1\n\n## Context"])
    expect(await main(["link"], ENV, deps)).toBe(0)
    const patches = calls.filter((call) => call.method === "PATCH")
    expect(patches).toHaveLength(2)
    expect(patches[1]?.body).toEqual({
      body: `Closes #1\n\n${linksBlock(URL, [{ title: "UI/Button", id: "ui-button--docs", type: "docs" }])}\n\n## Context`,
    })
    expect(logs).toContain("Linked 1 changed component(s) in the description.")
  })

  it("warns, without failing, when other jobs keep rewriting the description", async () => {
    const files = [{ filename: "src/components/ui/button.tsx", status: "modified" }]
    const { deps, calls, logs } = fakeDeps(files, "A", ["B", "C", "D"])
    expect(await main(["link"], ENV, deps)).toBe(0)
    expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(3)
    expect(logs).toContain(
      "::warning::Other jobs kept rewriting the PR's description; Storybook links not updated.",
    )
  })

  it("leaves an up-to-date description alone", async () => {
    const body = `${linksBlock(URL, [])}\n\n## Context`
    const { deps, calls } = fakeDeps([{ filename: "README.md", status: "modified" }], body)
    expect(await main(["link"], ENV, deps)).toBe(0)
    expect(calls.some((call) => call.method === "PATCH")).toBe(false)
  })

  it("fails without the preview URL, and on an unknown command", async () => {
    const { deps, logs } = fakeDeps([], "")
    expect(await main(["link"], { ...ENV, PREVIEW_URL: "" }, deps)).toBe(1)
    expect(logs).toContain("::error::Missing required env var PREVIEW_URL")
    expect(await main(["nope"], ENV, deps)).toBe(2)
  })
})
