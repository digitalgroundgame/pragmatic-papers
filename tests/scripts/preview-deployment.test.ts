import { describe, expect, it } from "vitest"

import {
  type CoolifyDeployment,
  type Deps,
  findDeployment,
  main,
  previewUrl,
  readConfig,
  toGithubState,
} from "../../scripts/preview-deployment"

const SHA = "a".repeat(40)
const ENV = {
  GITHUB_REPOSITORY: "digitalgroundgame/pragmatic-papers",
  GITHUB_TOKEN: "gh-token",
  PR_NUMBER: "42",
  HEAD_REF: "feat/thing",
  HEAD_SHA: SHA,
  COOLIFY_DASHBOARD_URL: "https://coolify.test/",
  COOLIFY_API_TOKEN: "coolify-token",
  COOLIFY_PREVIEW_APP_UUID: "app-uuid",
}

function row(status: string, over: Partial<CoolifyDeployment> = {}): CoolifyDeployment {
  return {
    deployment_uuid: "dep-uuid",
    pull_request_id: 42,
    commit: SHA,
    status,
    deployment_url: "/project/p/environment/e/application/app-uuid/deployment/dep-uuid",
    ...over,
  }
}

interface Call {
  method: string
  url: string
  auth: string
  body?: Record<string, unknown>
}

/**
 * A fake of both APIs. Each Coolify poll returns the next entry of `polls`
 * (the last one repeats); an entry that is a number is returned as that HTTP
 * status instead.
 */
function harness({
  polls = [[row("finished")]],
  deploymentSha = SHA,
  existing = [] as { id: number; state: string }[],
}: {
  polls?: (CoolifyDeployment[] | number)[]
  deploymentSha?: string
  existing?: { id: number; state: string }[]
} = {}) {
  const calls: Call[] = []
  const logs: string[] = []
  let clock = 0
  let poll = 0
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

  const deps: Deps = {
    fetch: (async (input: string, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({
        method,
        url: input,
        auth: (init?.headers as Record<string, string>).Authorization ?? "",
        body,
      })

      if (input.startsWith("https://coolify.test/")) {
        const next = polls[Math.min(poll++, polls.length - 1)] ?? []
        return typeof next === "number"
          ? json({ message: "nope" }, next)
          : json({ count: next.length, deployments: next })
      }
      if (method === "POST" && input.endsWith("/deployments"))
        return json({ id: 100, sha: deploymentSha }, 201)
      if (method === "POST" && input.endsWith("/statuses")) return json({}, 201)
      if (input.includes("/deployments?"))
        return json([{ id: 100 }, ...existing.map(({ id }) => ({ id }))])
      const status = input.match(/\/deployments\/(\d+)\/statuses\?/)
      if (status) {
        const found = existing.find((d) => d.id === Number(status[1]))
        return json(found ? [{ state: found.state }] : [])
      }
      throw new Error(`unexpected ${method} ${input}`)
    }) as typeof fetch,
    sleep: async (ms) => {
      clock += ms
    },
    now: () => clock,
    log: (message) => logs.push(message),
  }

  const statuses = () =>
    calls
      .filter((c) => c.method === "POST" && c.url.endsWith("/statuses"))
      .map(
        (c) =>
          ({ id: Number(c.url.match(/deployments\/(\d+)/)![1]), ...c.body }) as {
            id: number
            state?: string
          },
      )

  return { deps, calls, logs, statuses, elapsed: () => clock }
}

describe("toGithubState", () => {
  it.each([
    ["queued", "queued"],
    ["in_progress", "in_progress"],
    ["finished", "success"],
    ["failed", "failure"],
    ["cancelled-by-user", "inactive"],
  ])("maps Coolify %s to %s", (coolify, github) => {
    expect(toGithubState(coolify)?.state).toBe(github)
  })

  it("returns null for a status it doesn't know", () => {
    expect(toGithubState("paused")).toBeNull()
  })
})

describe("previewUrl", () => {
  it("fills Coolify's {{pr_id}} placeholder", () => {
    expect(previewUrl("https://pr-{{pr_id}}.example.com/{{pr_id}}", 7)).toBe(
      "https://pr-7.example.com/7",
    )
  })
})

describe("findDeployment", () => {
  it("takes the newest deploy of the PR's head commit", () => {
    const rows = [
      row("in_progress", { pull_request_id: 41, deployment_uuid: "other-pr" }),
      row("queued", { commit: "b".repeat(40), deployment_uuid: "other-commit" }),
      row("in_progress", { deployment_uuid: "newest" }),
      row("failed", { deployment_uuid: "older" }),
    ]
    expect(findDeployment(rows, 42, SHA)?.deployment_uuid).toBe("newest")
  })

  it("skips deploys queued before `since`, keeping ones without a timestamp", () => {
    const since = Date.parse("2026-09-27T20:00:00Z")
    const old = row("finished", { created_at: "2026-09-27T19:00:00.000000Z" })
    const fresh = row("queued", { created_at: "2026-09-27T20:00:05.000000Z" })
    expect(findDeployment([old], 42, SHA, since)).toBeUndefined()
    expect(findDeployment([fresh, old], 42, SHA, since)).toBe(fresh)
    expect(findDeployment([row("queued")], 42, SHA, since)).toBeDefined()
  })

  it("ignores staging deploys (pull_request_id 0)", () => {
    expect(findDeployment([row("finished", { pull_request_id: 0 })], 42, SHA)).toBeUndefined()
  })
})

describe("readConfig", () => {
  it("returns null when Coolify isn't configured", () => {
    expect(readConfig({ ...ENV, COOLIFY_API_TOKEN: "" })).toBeNull()
    expect(readConfig({ ...ENV, COOLIFY_DASHBOARD_URL: undefined })).toBeNull()
  })

  it("trims the Coolify URL's trailing slash and defaults the preview template", () => {
    expect(readConfig(ENV)).toMatchObject({
      coolifyUrl: "https://coolify.test",
      pr: 42,
      previewUrlTemplate: "https://pr-{{pr_id}}.pragmaticpapers.com",
    })
  })

  it.each([
    "https://coolify.test/api/v1",
    "https://coolify.test/api/v1/",
    "https://coolify.test/api",
  ])("accepts COOLIFY_DASHBOARD_URL with the API path on the end (%s)", (url) => {
    expect(readConfig({ ...ENV, COOLIFY_DASHBOARD_URL: url })?.coolifyUrl).toBe(
      "https://coolify.test",
    )
  })

  it("takes `since` from EVENT_AT, less the clock-skew allowance", () => {
    expect(readConfig({ ...ENV, EVENT_AT: "2026-09-27T20:00:00Z" })?.since).toBe(
      Date.parse("2026-09-27T19:58:00Z"),
    )
    expect(readConfig(ENV)?.since).toBeUndefined()
    expect(readConfig({ ...ENV, EVENT_AT: "garbage" })?.since).toBeUndefined()
  })

  it("rejects a missing or non-numeric PR number", () => {
    expect(() => readConfig({ ...ENV, PR_NUMBER: "" })).toThrow("PR_NUMBER")
    expect(() => readConfig({ ...ENV, PR_NUMBER: "abc" })).toThrow("PR_NUMBER")
  })
})

describe("main deploy", () => {
  it("skips without Coolify settings, making no requests", async () => {
    const h = harness()
    expect(await main(["deploy"], { ...ENV, COOLIFY_PREVIEW_APP_UUID: "" }, h.deps)).toBe(0)
    expect(h.calls).toHaveLength(0)
    expect(h.logs.join("\n")).toContain("skipping")
  })

  it("rejects an unknown mode", async () => {
    expect(await main(["publish"], ENV, harness().deps)).toBe(2)
  })

  it("follows the build to success on the PR's branch, then retires older deployments", async () => {
    const h = harness({
      polls: [[], [row("queued")], [row("in_progress")], [row("in_progress")], [row("finished")]],
      existing: [
        { id: 90, state: "success" },
        { id: 80, state: "inactive" },
      ],
    })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)

    const create = h.calls.find((c) => c.method === "POST" && c.url.endsWith("/deployments"))!
    expect(create.url).toBe(
      "https://api.github.com/repos/digitalgroundgame/pragmatic-papers/deployments",
    )
    expect(create.body).toMatchObject({
      ref: "feat/thing",
      environment: "Preview",
      required_contexts: [],
      transient_environment: true,
      production_environment: false,
    })

    const logUrl =
      "https://coolify.test/project/p/environment/e/application/app-uuid/deployment/dep-uuid"
    expect(h.statuses()).toEqual([
      expect.objectContaining({ id: 100, state: "queued", log_url: logUrl }),
      expect.objectContaining({ id: 100, state: "in_progress", log_url: logUrl }),
      expect.objectContaining({
        id: 100,
        state: "success",
        environment_url: "https://pr-42.pragmaticpapers.com",
        log_url: logUrl,
        auto_inactive: false,
      }),
      // 80 is already inactive; 100 is the new one.
      expect.objectContaining({ id: 90, state: "inactive" }),
    ])
    expect(h.statuses()[0]).not.toHaveProperty("environment_url")
  })

  it("sends Coolify's token to Coolify and GitHub's to GitHub", async () => {
    const h = harness()
    await main(["deploy"], ENV, h.deps)
    const tokens = new Map(h.calls.map((c) => [new URL(c.url).host, c.auth]))
    expect(Object.fromEntries(tokens)).toEqual({
      "coolify.test": "Bearer coolify-token",
      "api.github.com": "Bearer gh-token",
    })
    expect(h.calls[0]?.url).toBe(
      "https://coolify.test/api/v1/deployments/applications/app-uuid?take=50",
    )
  })

  it("reports a failed build as failure and leaves older deployments alone", async () => {
    const h = harness({ polls: [[row("failed")]], existing: [{ id: 90, state: "success" }] })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.statuses()).toEqual([expect.objectContaining({ id: 100, state: "failure" })])
  })

  it("creates nothing when Coolify never queues the commit", async () => {
    const h = harness({ polls: [[row("finished", { commit: "b".repeat(40) })]] })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.calls.every((c) => c.url.startsWith("https://coolify.test/"))).toBe(true)
    expect(h.elapsed()).toBeLessThanOrEqual(10 * 60_000)
    expect(h.logs.join("\n")).toContain("no Deployment created")
  })

  it("on reopen, waits for the new build rather than reporting the pre-close one", async () => {
    const old = row("finished", { created_at: "2026-09-27T19:00:00.000000Z" })
    const fresh = (status: string) =>
      row(status, { deployment_uuid: "new", created_at: "2026-09-27T20:00:30.000000Z" })
    const h = harness({ polls: [[old], [fresh("in_progress"), old], [fresh("finished"), old]] })
    expect(await main(["deploy"], { ...ENV, EVENT_AT: "2026-09-27T20:00:00Z" }, h.deps)).toBe(0)
    expect(h.statuses().map((s) => s.state)).toEqual(["in_progress", "success"])
  })

  it("retries a Coolify outage while waiting", async () => {
    const h = harness({ polls: [502, 502, [row("finished")]] })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.statuses().map((s) => s.state)).toEqual(["success"])
    expect(h.logs.filter((l) => l.includes("retrying"))).toHaveLength(2)
  })

  it("fails the run on a Coolify 4xx, like a bad token or app UUID", async () => {
    const h = harness({ polls: [401] })
    expect(await main(["deploy"], ENV, h.deps)).toBe(1)
    expect(h.logs.join("\n")).toMatch(/::error::GET https:\/\/coolify\.test\/.* → 401/)
  })

  it("steps aside when the branch has already moved to a newer commit", async () => {
    const h = harness({ deploymentSha: "c".repeat(40) })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.statuses()).toEqual([expect.objectContaining({ id: 100, state: "inactive" })])
  })

  it("marks the deployment errored when the build outlasts the timeout", async () => {
    const h = harness({ polls: [[row("in_progress")]] })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.statuses().map((s) => s.state)).toEqual(["in_progress", "error"])
    expect(h.elapsed()).toBeLessThanOrEqual(45 * 60_000)
  })
})

describe("main close", () => {
  it("marks every active preview deployment for the branch inactive", async () => {
    const h = harness({
      existing: [
        { id: 90, state: "success" },
        { id: 80, state: "inactive" },
      ],
    })
    expect(await main(["close"], ENV, h.deps)).toBe(0)
    // 100 comes back from the listing with no statuses; 80 is already inactive.
    expect(h.statuses().map((s) => s.id)).toEqual([100, 90])
    expect(h.statuses().every((s) => s.state === "inactive")).toBe(true)
    const list = h.calls.find((c) => c.url.includes("/deployments?"))!
    expect(list.url).toContain("environment=Preview&ref=feat%2Fthing")
  })
})
