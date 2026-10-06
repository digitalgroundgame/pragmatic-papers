import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import {
  closedPreviewDatabases,
  DEFAULT_REPOSITORY,
  dropClosedPreviewDatabases,
  type Fetch,
  main,
  openPullRequests,
  type PgClient,
  previewPr,
} from "../../dockerfiles/scripts/drop-closed-preview-databases"

const SCRIPT = resolve(__dirname, "../../dockerfiles/scripts/drop-closed-preview-databases.ts")
const PASSWORD = "hunter2-s3cret"
const PREVIEW_URI = `postgres://app:${PASSWORD}@db.internal:5432/pragmatic_papers_pr_12?sslmode=require`

describe("previewPr", () => {
  it.each([
    ["pragmatic_papers_pr_12", 12],
    ["pragmatic_papers_pr_12_incoming", 12],
  ])("reads the PR from %s", (name, pr) => {
    expect(previewPr(name, "pragmatic_papers")).toBe(pr)
  })

  it.each([
    "pragmatic_papers",
    "pragmatic_papers_pr_",
    "pragmatic_papers_pr_12_old",
    "pragmatic_papers_pr_12x",
    "other_pr_12",
    "pragmatic_papers_production_pr_12",
    "xpragmatic_papers_pr_12",
    "postgres",
  ])("isn't fooled by %s", (name) => {
    expect(previewPr(name, "pragmatic_papers")).toBeUndefined()
  })

  it("treats the source name literally, not as a pattern", () => {
    expect(previewPr("pragmaticXpapers_pr_1", "pragmatic.papers")).toBeUndefined()
    expect(previewPr("pragmatic.papers_pr_1", "pragmatic.papers")).toBe(1)
  })
})

describe("closedPreviewDatabases", () => {
  it("keeps open PRs' databases and everything that isn't a preview's", () => {
    const databases = [
      "postgres",
      "pragmatic_papers",
      "pragmatic_papers_pr_3",
      "pragmatic_papers_pr_7",
      "pragmatic_papers_pr_7_incoming",
      "pragmatic_papers_pr_9_incoming",
      "pragmatic_papers_pr_12",
    ]
    expect(closedPreviewDatabases(databases, "pragmatic_papers", new Set([7, 12]))).toEqual([
      "pragmatic_papers_pr_3",
      "pragmatic_papers_pr_9_incoming",
    ])
  })
  it("leaves a PR newer than every listed one, which may just be too new to be listed", () => {
    const databases = ["pragmatic_papers_pr_3", "pragmatic_papers_pr_12", "pragmatic_papers_pr_13"]
    expect(closedPreviewDatabases(databases, "pragmatic_papers", new Set([12]))).toEqual([
      "pragmatic_papers_pr_3",
    ])
  })
})

/** A fetch that serves `pages` of open PR numbers in turn and records the URLs asked for. */
function fakeGitHub(pages: number[][], status = 200) {
  const requests: { url: string; headers?: Record<string, string> }[] = []
  const fetch: Fetch = async (url, init) => {
    requests.push({ url, headers: init?.headers })
    const page = Number(new URL(url).searchParams.get("page"))
    const body = (pages[page - 1] ?? []).map((number) => ({ number }))
    return new Response(JSON.stringify(body), { status })
  }
  return { fetch, requests }
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i)

describe("openPullRequests", () => {
  it("reads every page", async () => {
    const { fetch, requests } = fakeGitHub([range(1, 100), range(101, 100), [201]])
    const open = await openPullRequests(fetch, "owner/repo")
    expect(open.size).toBe(201)
    expect(requests.map((r) => new URL(r.url).searchParams.get("page"))).toEqual(["1", "2", "3"])
    expect(requests[0]!.url).toBe(
      "https://api.github.com/repos/owner/repo/pulls?state=open&per_page=100&page=1",
    )
  })

  it("sends a token only when there is one", async () => {
    const anonymous = fakeGitHub([[1]])
    await openPullRequests(anonymous.fetch, "owner/repo")
    expect(anonymous.requests[0]!.headers).not.toHaveProperty("Authorization")

    const withToken = fakeGitHub([[1]])
    await openPullRequests(withToken.fetch, "owner/repo", "t0ken")
    expect(withToken.requests[0]!.headers).toHaveProperty("Authorization", "Bearer t0ken")
  })

  it("fails on an error response rather than returning a partial list", async () => {
    await expect(openPullRequests(fakeGitHub([[1]], 403).fetch, "owner/repo")).rejects.toThrow(
      "GitHub answered 403",
    )
  })
})

/**
 * A pg client over a fixed list of databases that records statements. `connected` lists
 * the databases pg_stat_activity reports clients on; dropping one in `failDrop` fails.
 */
function fakeClient(databases: string[], failDrop: string[] = [], connected: string[] = []) {
  const statements: string[] = []
  const events: string[] = []
  const client = {
    async connect() {
      events.push("connect")
    },
    async end() {
      events.push("end")
    },
    escapeIdentifier: (name: string) => `"${name.replaceAll('"', '""')}"`,
    async query(text: string, values?: unknown[]) {
      statements.push(values ? `${text} ${JSON.stringify(values)}` : text)
      if (text.startsWith("SELECT datname"))
        return { rows: databases.map((datname) => ({ datname })) }
      if (text.includes("pg_stat_activity")) {
        const asked = (values?.[0] ?? []) as string[]
        return {
          rows: connected.filter((db) => asked.includes(db)).map((datname) => ({ datname })),
        }
      }
      const dropped = /^DROP DATABASE IF EXISTS "(.*)"$/.exec(text)?.[1]
      if (dropped && failDrop.includes(dropped)) throw new Error(`must be owner of ${dropped}`)
      return { rows: [] }
    },
  }
  return { client: client as unknown as PgClient, statements, events }
}

const DATABASES = [
  "pragmatic_papers",
  "pragmatic_papers_pr_3",
  "pragmatic_papers_pr_3_incoming",
  "pragmatic_papers_pr_12",
]

describe("dropClosedPreviewDatabases", () => {
  const options = { source: "pragmatic_papers", currentPr: 12, repository: "owner/repo" }

  it("drops only the closed PRs' preview databases, without disconnecting anyone", async () => {
    const { client, statements } = fakeClient(DATABASES)
    const logs: string[] = []
    const dropped = await dropClosedPreviewDatabases(
      { client, fetch: fakeGitHub([[12, 40]]).fetch, log: (m) => logs.push(m) },
      options,
    )

    expect(dropped).toEqual(["pragmatic_papers_pr_3", "pragmatic_papers_pr_3_incoming"])
    expect(statements).toEqual([
      'SELECT datname FROM pg_database WHERE datname LIKE $1 ["pragmatic\\\\_papers\\\\_pr\\\\_%"]',
      'SELECT DISTINCT datname FROM pg_stat_activity WHERE datname = ANY($1) [["pragmatic_papers_pr_3","pragmatic_papers_pr_3_incoming"]]',
      'DROP DATABASE IF EXISTS "pragmatic_papers_pr_3"',
      'DROP DATABASE IF EXISTS "pragmatic_papers_pr_3_incoming"',
    ])
    expect(statements.join("\n")).not.toContain("pg_terminate_backend")
    expect(logs).toContain("Dropped pragmatic_papers_pr_3")
  })

  it("keeps a closed PR's database while something is connected to it", async () => {
    // A live preview's app is always connected, so this is what saves an open PR that
    // GitHub's list missed (one that moved between pages while they were read).
    const { client, statements } = fakeClient(DATABASES, [], ["pragmatic_papers_pr_3"])
    const logs: string[] = []
    const dropped = await dropClosedPreviewDatabases(
      { client, fetch: fakeGitHub([[12, 40]]).fetch, log: (m) => logs.push(m) },
      options,
    )

    expect(dropped).toEqual(["pragmatic_papers_pr_3_incoming"])
    expect(statements).not.toContain('DROP DATABASE IF EXISTS "pragmatic_papers_pr_3"')
    expect(logs).toContain("Keeping pragmatic_papers_pr_3: something is still connected to it")
  })

  it("drops nothing when GitHub's list doesn't include the PR being built", async () => {
    const { client, statements } = fakeClient(DATABASES)
    const logs: string[] = []
    const dropped = await dropClosedPreviewDatabases(
      { client, fetch: fakeGitHub([[40]]).fetch, log: (m) => logs.push(m) },
      options,
    )

    expect(dropped).toEqual([])
    expect(statements).toEqual([])
    expect(logs.join("\n")).toContain("not trusting the list")
  })

  it("keeps going when one drop fails", async () => {
    const { client } = fakeClient(DATABASES, ["pragmatic_papers_pr_3"])
    const logs: string[] = []
    const dropped = await dropClosedPreviewDatabases(
      { client, fetch: fakeGitHub([[12]]).fetch, log: (m) => logs.push(m) },
      options,
    )

    expect(dropped).toEqual(["pragmatic_papers_pr_3_incoming"])
    expect(logs).toContain(
      "Couldn't drop pragmatic_papers_pr_3: must be owner of pragmatic_papers_pr_3",
    )
  })

  it("says so when there's nothing to drop", async () => {
    const logs: string[] = []
    await dropClosedPreviewDatabases(
      {
        client: fakeClient(["pragmatic_papers_pr_12"]).client,
        fetch: fakeGitHub([[12]]).fetch,
        log: (m) => logs.push(m),
      },
      options,
    )
    expect(logs).toContain("No closed PRs' preview databases to drop")
  })
})

describe("main", () => {
  const PREVIEW = {
    COPY_SOURCE_DATABASE: "true",
    SOURCE_DATABASE_NAME: "pragmatic_papers",
    DATABASE_URI: PREVIEW_URI,
  }

  async function run(env: Record<string, string>, fetch: Fetch, client = fakeClient(DATABASES)) {
    const logs: string[] = []
    const status = await main(env, { client: client.client, fetch, log: (m) => logs.push(m) })
    return { status, output: logs.join("\n"), ...client }
  }

  it("works out the PR from the preview database and cleans up", async () => {
    const github = fakeGitHub([[12]])
    const { status, output, events } = await run(PREVIEW, github.fetch)

    expect(status).toBe(0)
    expect(output).toContain("Dropped pragmatic_papers_pr_3")
    expect(events).toEqual(["connect", "end"])
    expect(github.requests[0]!.url).toContain(`/repos/${DEFAULT_REPOSITORY}/pulls`)
  })

  it("uses GITHUB_REPOSITORY and GITHUB_TOKEN when set", async () => {
    const github = fakeGitHub([[12]])
    await run({ ...PREVIEW, GITHUB_REPOSITORY: "fork/repo", GITHUB_TOKEN: "t0ken" }, github.fetch)
    expect(github.requests[0]!.url).toContain("/repos/fork/repo/pulls")
    expect(github.requests[0]!.headers).toHaveProperty("Authorization", "Bearer t0ken")
  })

  it.each([
    ["staging and production builds", { ...PREVIEW, COPY_SOURCE_DATABASE: "" }],
    ["a build without a source database", { ...PREVIEW, SOURCE_DATABASE_NAME: "" }],
    [
      "a DATABASE_URI that isn't a preview's",
      { ...PREVIEW, DATABASE_URI: PREVIEW_URI.replace("_pr_12", "") },
    ],
  ])("does nothing for %s", async (_, env) => {
    const github = fakeGitHub([[12]])
    const { status, events } = await run(env, github.fetch)
    expect(status).toBe(0)
    expect(events).toEqual([])
    expect(github.requests).toEqual([])
  })

  it("never fails the build, and never prints the password", async () => {
    const offline: Fetch = () => Promise.reject(new Error("getaddrinfo ENOTFOUND api.github.com"))
    const { status, output, events } = await run(PREVIEW, offline)

    expect(status).toBe(0)
    expect(output).toContain("Skipping cleanup: getaddrinfo ENOTFOUND api.github.com")
    expect(output).not.toContain(PASSWORD)
    expect(events).toEqual(["connect", "end"])
  })

  it("connects to the server's maintenance database with the preview's credentials", async () => {
    // No client override: main builds its own, which fails to connect to the fake host.
    const logs: string[] = []
    const status = await main(
      { ...PREVIEW, DATABASE_URI: PREVIEW_URI.replace("db.internal:5432", "127.0.0.1:1") },
      { fetch: fakeGitHub([[12]]).fetch, log: (m) => logs.push(m) },
    )
    expect(status).toBe(0)
    expect(logs.join("\n")).toMatch(/Skipping cleanup: connect ECONNREFUSED 127\.0\.0\.1:1/)
    expect(logs.join("\n")).not.toContain(PASSWORD)
  })
})

describe("the entry point", () => {
  // The Dockerfile runs the file with plain `node`, which only strips types.
  it("runs under plain node and exits 0 when there's nothing to do", () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf-8",
      env: { ...process.env, COPY_SOURCE_DATABASE: "", SOURCE_DATABASE_NAME: "" },
    })
    expect(result.stdout).toContain("Not a preview build with a database copy")
    expect(result.status).toBe(0)
  })
})
