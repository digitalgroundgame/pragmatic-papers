import { describe, expect, it } from "vitest"

import {
  addedSlugs,
  catalogSlugs,
  type Deps,
  hasShowcaseLine,
  LINKS_END,
  LINKS_START,
  main,
  optOut,
  planSync,
  withLinks,
  withShowcaseLine,
} from "../../scripts/showcase-pr"

const REPO = "digitalgroundgame/pragmatic-papers"
const SHA = "a".repeat(40)
const ENV = { GITHUB_REPOSITORY: REPO, GITHUB_TOKEN: "gh-token", PR_NUMBER: "42" }

const catalog = (...slugs: string[]) =>
  `export const showcaseEntries = [\n${slugs.map((slug) => `  {\n    slug: "${slug}",\n  },`).join("\n")}\n]\n`

const block = (...links: string[]) =>
  `${LINKS_START}\n**On the preview:**\n\n${links.join("\n")}\n${LINKS_END}`

describe("hasShowcaseLine", () => {
  it.each([
    "Showcase: first",
    "**Showcase:** `first`",
    "- showcase: first",
    "## Context\r\n\r\nShowcase: all\r\n",
  ])("finds %j", (body) => expect(hasShowcaseLine(body)).toBe(true))

  it("ignores the word in prose", () => {
    expect(hasShowcaseLine("Adds a showcase for the table of contents")).toBe(false)
  })
})

describe("withShowcaseLine", () => {
  it("appends a line after the description", () => {
    expect(withShowcaseLine("## Context\n\nText\n\n", ["first", "second"])).toBe(
      "## Context\n\nText\n\nShowcase: first second\n",
    )
  })
})

describe("optOut", () => {
  it("removes the line and the link list, and leaves the rest", () => {
    const body = `## Context\r\n\r\nShowcase: first\r\n\r\n## Test Plan\r\n\r\n- ok\r\n\r\n${block("- [first](u)")}\n`
    expect(optOut(body)).toBe("## Context\n\n## Test Plan\n\n- ok")
  })

  it.each(["## Context\n\nText", "Text\n", "## Context\r\n\r\nText\r\n", "Text\n\n\n\nMore"])(
    "leaves %j, with neither, untouched",
    (body) => expect(optOut(body)).toBe(body),
  )
})

describe("withLinks", () => {
  it("adds a list at the top", () => {
    expect(withLinks("## Context\n\nText\n", ["- [first](u)"])).toBe(
      `${block("- [first](u)")}\n\n## Context\n\nText\n`,
    )
  })

  it("adds a list under the issues the PR closes", () => {
    const body = "Closes #743\nFixes owner/repo#12\n\n## Context\n\nText"
    expect(withLinks(body, ["- [first](u)"])).toBe(
      `Closes #743\nFixes owner/repo#12\n\n${block("- [first](u)")}\n\n## Context\n\nText`,
    )
  })

  it.each(["Text\n\nCloses #743", "Fix the carousel, as #743 asks"])(
    "adds a list above %j, which closes nothing at the top",
    (body) => {
      expect(withLinks(body, ["- [first](u)"])).toBe(`${block("- [first](u)")}\n\n${body}`)
    },
  )

  it("adds a list to an empty description", () => {
    expect(withLinks("", ["- [first](u)"])).toBe(`${block("- [first](u)")}\n`)
    expect(withLinks("Closes #1", ["- [first](u)"])).toBe(`Closes #1\n\n${block("- [first](u)")}\n`)
  })

  it("replaces the list in place", () => {
    const body = `Text\n\n${block("- [first](u)")}\n\nAfter`
    expect(withLinks(body, ["- [second](v)"])).toBe(`Text\n\n${block("- [second](v)")}\n\nAfter`)
  })

  it("removes the list when there are no links", () => {
    expect(withLinks(`Text\n\n${block("- [first](u)")}\n`, [])).toBe("Text")
  })

  it("keeps $ in links literal", () => {
    expect(withLinks(block("old"), ["- [a]($1)"])).toBe(block("- [a]($1)"))
  })
})

describe("catalogSlugs and addedSlugs", () => {
  it("reads the registered slugs", () => {
    expect(catalogSlugs(catalog("first", "second"))).toEqual(["first", "second"])
  })

  it("names only the slugs the head adds", () => {
    expect(addedSlugs(catalog("first"), catalog("first", "new-demo"))).toEqual(["new-demo"])
    expect(addedSlugs(catalog("first"), catalog("first"))).toEqual([])
    expect(addedSlugs("", catalog("first"))).toEqual(["first"])
  })
})

describe("planSync", () => {
  const none = async () => []
  const adds =
    (...slugs: string[]) =>
    async () =>
      slugs

  it("inserts the PR's new articles when the label is added", async () => {
    expect(await planSync("labeled", "Text", true, adds("new-demo"))).toEqual({
      body: "Text\n\nShowcase: new-demo\n",
      push: true,
    })
  })

  it("keeps an existing line when the label is added, without looking at the catalog", async () => {
    const added = async () => {
      throw new Error("not needed")
    }
    expect(await planSync("labeled", "Showcase: first", true, added)).toEqual({ push: true })
  })

  it("takes the label off again when the PR adds no article", async () => {
    const plan = await planSync("labeled", "Text", true, none)
    expect(plan).toMatchObject({ label: "remove", push: false })
    expect(plan.notice).toContain("adds no article")
    expect(plan.body).toBeUndefined()
  })

  it("removes the line and links when the label is removed", async () => {
    expect(await planSync("unlabeled", "Text\n\nShowcase: first", false, none)).toEqual({
      body: "Text",
      push: false,
    })
    expect(await planSync("unlabeled", "Text", false, none)).toEqual({
      body: undefined,
      push: false,
    })
  })

  it("adds the label for a line, and pushes", async () => {
    expect(await planSync("opened", "Showcase: first", false, none)).toEqual({
      label: "add",
      push: true,
    })
    expect(await planSync("edited", "Showcase: first", true, none)).toEqual({
      label: undefined,
      push: true,
    })
  })

  it("removes the label and links when the line is deleted", async () => {
    expect(await planSync("edited", `Text\n\n${block("- [first](u)")}`, true, none)).toEqual({
      body: "Text",
      label: "remove",
      push: false,
    })
  })

  it.each(["Text", "Text\n", "## Context\r\n\r\nText\r\n"])(
    "doesn't edit %j, from a PR that never opted in",
    async (body) => {
      for (const action of ["opened", "edited", "unlabeled"] as const) {
        expect((await planSync(action, body, false, none)).body).toBeUndefined()
      }
    },
  )
})

interface Call {
  method: string
  path: string
  accept: string
  body?: Record<string, unknown>
}

/** A fake GitHub API over one PR, recording every call. */
function harness({
  body = "",
  headRepo = REPO as string | null,
  catalogs = {} as Record<string, string>,
  deployments = [] as { id: number; sha: string; state: string }[],
  files = {} as Record<string, string>,
} = {}) {
  const calls: Call[] = []
  const logs: string[] = []
  const outputs: Record<string, string> = {}
  const summary: string[] = []
  const written: Record<string, string> = {}
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

  const deps: Deps = {
    fetch: (async (input: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      const url = new URL(input)
      const path = url.pathname.replace(`/repos/${REPO}`, "")
      const headers = init?.headers as Record<string, string>
      const data = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ method, path: `${path}${url.search}`, accept: headers.Accept!, body: data })

      if (path === "/pulls/42" && method === "GET")
        return json({
          body,
          head: { sha: SHA, ref: "feat/demo", repo: headRepo && { full_name: headRepo } },
        })
      if (path === "/pulls/42" && method === "PATCH") return json({})
      if (path === "/issues/42/labels" && method === "POST") return json([])
      if (path === "/issues/42/labels/showcase" && method === "DELETE")
        return new Response(null, { status: 204 })
      if (path.startsWith("/contents/")) {
        const source = catalogs[url.searchParams.get("ref")!]
        return source === undefined ? json({ message: "Not Found" }, 404) : new Response(source)
      }
      if (path === "/deployments") return json(deployments.map(({ id, sha }) => ({ id, sha })))
      const status = path.match(/^\/deployments\/(\d+)\/statuses$/)
      if (status) {
        const found = deployments.find((d) => d.id === Number(status[1]))
        return json(found ? [{ state: found.state }] : [])
      }
      throw new Error(`unexpected ${method} ${input}`)
    }) as typeof fetch,
    log: (message) => logs.push(message),
    output: (name, value) => {
      outputs[name] = value
    },
    summary: (markdown) => summary.push(markdown),
    readFile: (path) => files[path] ?? "",
    writeFile: (path, content) => {
      written[path] = content
    },
  }

  const edits = () => calls.filter((c) => c.method === "PATCH").map((c) => c.body?.body)
  return { deps, calls, logs, outputs, summary, written, edits }
}

describe("main", () => {
  it("rejects an unknown command", async () => {
    const h = harness()
    expect(await main(["nope"], ENV, h.deps)).toBe(2)
  })

  it("fails on a missing env var", async () => {
    const h = harness()
    expect(await main(["sync"], { ...ENV, ACTION: undefined }, h.deps)).toBe(1)
    expect(h.logs.at(-1)).toContain("ACTION")
  })

  describe("sync", () => {
    const env = { ...ENV, BASE_REF: "dev", HAS_LABEL: "true" }

    it("writes the PR's new article into the description when the label is added", async () => {
      const h = harness({
        body: "## Context",
        catalogs: { dev: catalog("first"), [SHA]: catalog("first", "new-demo") },
      })
      expect(await main(["sync"], { ...env, ACTION: "labeled" }, h.deps)).toBe(0)
      expect(h.edits()).toEqual(["## Context\n\nShowcase: new-demo\n"])
      expect(h.calls.find((c) => c.path.startsWith("/contents/"))?.accept).toBe(
        "application/vnd.github.raw",
      )
      expect(h.outputs).toEqual({ push: "true" })
    })

    it("takes the label off, with a note, when the PR adds no article", async () => {
      const h = harness({
        body: "## Context",
        catalogs: { dev: catalog("first"), [SHA]: catalog("first") },
      })
      expect(await main(["sync"], { ...env, ACTION: "labeled" }, h.deps)).toBe(0)
      expect(h.edits()).toEqual([])
      expect(h.calls.some((c) => c.method === "DELETE")).toBe(true)
      expect(h.summary[0]).toContain("adds no article")
      expect(h.outputs).toEqual({ push: "false" })
    })

    it("adds the label for a description with a line", async () => {
      const h = harness({ body: "Showcase: first" })
      await main(["sync"], { ...env, HAS_LABEL: "false", ACTION: "opened" }, h.deps)
      expect(h.calls.find((c) => c.method === "POST")?.body).toEqual({ labels: ["showcase"] })
      expect(h.outputs).toEqual({ push: "true" })
    })
  })

  describe("resolve", () => {
    const env = { ...ENV, DESCRIPTION_FILE: "/tmp/description.md" }
    const up = [{ id: 7, sha: SHA, state: "success" }]

    it("hands over the PR's head and description when its preview is up", async () => {
      const h = harness({ body: "Showcase: first", deployments: up })
      expect(await main(["resolve"], env, h.deps)).toBe(0)
      expect(h.written).toEqual({ "/tmp/description.md": "Showcase: first" })
      expect(h.outputs).toEqual({ number: "42", sha: SHA })
    })

    it.each([
      ["no line", "Text", up],
      ["no deployment", "Showcase: first", []],
      [
        "a deployment of another commit",
        "Showcase: first",
        [{ id: 7, sha: "b".repeat(40), state: "success" }],
      ],
      ["a failed deployment", "Showcase: first", [{ id: 7, sha: SHA, state: "failure" }]],
    ])("skips with %s", async (_, body, deployments) => {
      const h = harness({ body, deployments })
      expect(await main(["resolve"], env, h.deps)).toBe(0)
      expect(h.outputs.skip).toBe("true")
    })

    it("doesn't check a manual run", async () => {
      const h = harness({ body: "Text" })
      await main(["resolve"], { ...env, MANUAL: "true" }, h.deps)
      expect(h.outputs.skip).toBeUndefined()
      expect(h.calls.some((c) => c.path.startsWith("/deployments"))).toBe(false)
    })

    it.each([
      ["a fork", "someone/fork"],
      ["a deleted fork", null],
    ])("refuses a PR from %s", async (_, headRepo) => {
      const h = harness({ body: "Showcase: first", headRepo })
      expect(await main(["resolve"], env, h.deps)).toBe(1)
      expect(h.logs.at(-1)).toContain("only same-repository PRs")
    })

    it("refuses a target that isn't a PR number", async () => {
      const h = harness()
      expect(await main(["resolve"], { ...env, PR_NUMBER: "stagin" }, h.deps)).toBe(1)
    })
  })

  describe("link", () => {
    it("lists the links in the description", async () => {
      const h = harness({ body: "Text", files: { "/tmp/links.md": "- [first](u)\n\n" } })
      expect(await main(["link"], { ...ENV, LINKS_FILE: "/tmp/links.md" }, h.deps)).toBe(0)
      expect(h.edits()).toEqual([`${block("- [first](u)")}\n\nText`])
    })

    it("doesn't edit a description that already lists them", async () => {
      const body = `Text\n\n${block("- [first](u)")}\n`
      const h = harness({ body, files: { "/tmp/links.md": "- [first](u)\n" } })
      await main(["link"], { ...ENV, LINKS_FILE: "/tmp/links.md" }, h.deps)
      expect(h.edits()).toEqual([])
    })
  })
})
