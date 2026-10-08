import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import {
  type CoolifyDeployment,
  type Deps,
  findDeployment,
  main,
  previewLink,
  previewUrl,
  readConfig,
  setPrLink,
  toGithubState,
  withPrLink,
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
 * status instead. Fetching one deployment by UUID polls too, and gets the
 * entry's first row. `deployed` is Coolify's answer to a deploy request, and
 * `deleteStatus` its status for deleting a preview. The preview's own URL answers as our
 * app for the first `previewAnswers` requests, then as a removed preview. The PR's
 * description starts as `prBody`; `prStatus` fails reading it with that status.
 */
function harness({
  polls = [[row("finished")]],
  deploymentSha = SHA,
  existing = [] as { id: number; state: string }[],
  deployed = { deployments: [{ message: "queued", deployment_uuid: "img-dep" }] } as unknown,
  deleteStatus = 200,
  previewAnswers = 0,
  prBody = "## Context\n\nText" as string | null,
  prStatus = 200,
}: {
  polls?: (CoolifyDeployment[] | number)[]
  deploymentSha?: string
  existing?: { id: number; state: string }[]
  deployed?: unknown
  deleteStatus?: number
  previewAnswers?: number
  prBody?: string | null
  prStatus?: number
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
      if (input.startsWith("https://pr-42.pragmaticpapers.com/")) {
        calls.push({ method, url: input, auth: "" })
        if (previewAnswers-- > 0)
          return new Response(null, {
            status: 404,
            headers: { "X-Powered-By": "Next.js, Payload" },
          })
        return new Response("no available server", { status: 503 })
      }
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({
        method,
        url: input,
        auth: (init?.headers as Record<string, string>).Authorization ?? "",
        body,
      })

      if (input.endsWith("/pulls/42")) {
        if (method === "PATCH") {
          prBody = body!.body as string
          return json({})
        }
        return prStatus === 200 ? json({ body: prBody }) : json({ message: "nope" }, prStatus)
      }
      if (input.startsWith("https://coolify.test/api/v1/deploy?")) return json(deployed)
      if (method === "DELETE") return json({ message: "queued" }, deleteStatus)
      if (input.startsWith("https://coolify.test/")) {
        const next = polls[Math.min(poll++, polls.length - 1)] ?? []
        if (typeof next === "number") return json({ message: "nope" }, next)
        return input.includes("/deployments/applications/")
          ? json({ count: next.length, deployments: next })
          : next[0]
            ? json(next[0])
            : json({ message: "Deployment not found." }, 404)
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

  const prEdits = () => calls.filter((c) => c.method === "PATCH").map((c) => c.body!.body as string)

  return { deps, calls, logs, statuses, prEdits, elapsed: () => clock }
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

const line = (...links: string[]) => `<!-- pr-links -->\n${links.join(" · ")}\n<!-- /pr-links -->`

describe("withPrLink", () => {
  const preview = previewLink("https://pr-42.pragmaticpapers.com", SHA)
  const coverage = "[Coverage](https://github.com/o/r/pull/42#issuecomment-1)"
  const shots = "[Screenshots](https://github.com/o/r/pull/42#issuecomment-2)"

  it("links the preview and the commit it runs", () => {
    expect(preview).toBe("[Preview](https://pr-42.pragmaticpapers.com) at `aaaaaaa`")
  })

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
    const old = previewLink("https://pr-42.pragmaticpapers.com", "b".repeat(40))
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

describe("setPrLink", () => {
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

    expect(h.statuses()).toEqual([
      expect.objectContaining({ id: 100, state: "queued" }),
      expect.objectContaining({ id: 100, state: "in_progress" }),
      expect.objectContaining({
        id: 100,
        state: "success",
        environment_url: "https://pr-42.pragmaticpapers.com",
        auto_inactive: false,
      }),
      // 80 is already inactive; 100 is the new one.
      expect.objectContaining({ id: 90, state: "inactive" }),
    ])
    expect(h.statuses()[0]).not.toHaveProperty("environment_url")
    // Statuses are public, so the Coolify dashboard URL must never appear in them.
    for (const status of h.statuses()) {
      expect(status).not.toHaveProperty("log_url")
      expect(JSON.stringify(status)).not.toContain("coolify.test")
    }
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

  it("links the live preview at the top of the PR's description", async () => {
    const h = harness({ prBody: "Closes #7\n\n## Context" })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.prEdits()).toEqual([
      `Closes #7\n\n${line(previewLink("https://pr-42.pragmaticpapers.com", SHA))}\n\n## Context`,
    ])
  })

  it("leaves a description that already links this commit alone", async () => {
    const block = line(previewLink("https://pr-42.pragmaticpapers.com", SHA))
    const h = harness({ prBody: `${block}\n\nText` })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.prEdits()).toEqual([])
  })

  it("only warns when the description can't be read", async () => {
    const h = harness({ prStatus: 403, prBody: null })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.statuses()).toContainEqual(expect.objectContaining({ state: "success" }))
    expect(h.logs.join("\n")).toContain("::warning::Couldn't set the Preview link")
  })

  it("reports a failed build as failure and leaves older deployments alone", async () => {
    const h = harness({ polls: [[row("failed")]], existing: [{ id: 90, state: "success" }] })
    expect(await main(["deploy"], ENV, h.deps)).toBe(0)
    expect(h.statuses()).toEqual([expect.objectContaining({ id: 100, state: "failure" })])
    expect(h.prEdits()).toEqual([])
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

  it("removes the preview link from the PR's description, keeping the others", async () => {
    const preview = previewLink("https://pr-42.pragmaticpapers.com", SHA)
    const h = harness({ prBody: `${line(preview, "[Coverage](u)")}\n\n## Context` })
    expect(await main(["close"], ENV, h.deps)).toBe(0)
    expect(h.prEdits()).toEqual([`${line("[Coverage](u)")}\n\n## Context`])
  })
})

describe("main deploy <image-tag>", () => {
  const imageRow = (status: string) => row(status, { deployment_uuid: "img-dep", commit: "HEAD" })

  it("asks Coolify to deploy the tag as the PR's preview, then follows that deployment", async () => {
    const h = harness({
      polls: [[imageRow("queued")], [imageRow("in_progress")], [imageRow("finished")]],
    })
    expect(await main(["deploy", "pr-42-abc1234"], ENV, h.deps)).toBe(0)

    const coolifyCalls = h.calls.filter((c) => c.url.startsWith("https://coolify.test/"))
    expect(coolifyCalls[0]).toMatchObject({
      method: "POST",
      url: "https://coolify.test/api/v1/deploy?uuid=app-uuid&pr=42&docker_tag=pr-42-abc1234",
      auth: "Bearer coolify-token",
    })
    // It follows the deployment it queued, whatever commit Coolify records for an image.
    expect(coolifyCalls.slice(1).map((c) => c.url)).toEqual(
      Array(3).fill("https://coolify.test/api/v1/deployments/img-dep"),
    )
    expect(h.statuses().map((s) => s.state)).toEqual(["queued", "in_progress", "success"])
    expect(h.logs.join("\n")).toContain("deployment img-dep")
  })

  it("waits out the 404 Coolify answers right after queueing the image", async () => {
    // An empty poll is Coolify's 404 "Deployment not found." for the queued UUID.
    const h = harness({ polls: [[], [], [imageRow("in_progress")], [imageRow("finished")]] })
    expect(await main(["deploy", "pr-42-abc1234"], ENV, h.deps)).toBe(0)

    expect(h.statuses().map((s) => s.state)).toEqual(["in_progress", "success"])
  })

  it("gives up without creating a Deployment when the queued image never appears", async () => {
    const h = harness({ polls: [[]] })
    expect(await main(["deploy", "pr-42-abc1234"], ENV, h.deps)).toBe(0)

    expect(h.statuses()).toEqual([])
    expect(h.logs.join("\n")).toContain("didn't queue a preview")
  })

  it("fails the run, creating nothing, when Coolify doesn't queue the image", async () => {
    const h = harness({
      deployed: {
        deployments: [{ message: "docker_tag can only be used with Docker Image applications." }],
      },
    })
    expect(await main(["deploy", "pr-42-abc1234"], ENV, h.deps)).toBe(1)
    expect(h.logs.join("\n")).toContain("Docker Image applications")
    expect(h.statuses()).toEqual([])
  })

  it("rejects a flag where the tag goes", async () => {
    expect(await main(["deploy", "--delete-preview"], ENV, harness().deps)).toBe(2)
  })
})

describe("main close --delete-preview", () => {
  it("removes the preview from Coolify, then retires the PR's deployments", async () => {
    const h = harness({ existing: [{ id: 90, state: "success" }] })
    expect(await main(["close", "--delete-preview"], ENV, h.deps)).toBe(0)
    expect(h.calls[0]).toMatchObject({
      method: "DELETE",
      url: "https://coolify.test/api/v1/applications/app-uuid/previews/42",
    })
    expect(h.statuses().map((s) => s.id)).toEqual([100, 90])
  })

  it("carries on when Coolify has no preview for the PR", async () => {
    const h = harness({ deleteStatus: 404 })
    expect(await main(["close", "--delete-preview"], ENV, h.deps)).toBe(0)
    expect(h.logs.join("\n")).toContain("no preview for PR #42")
  })

  it("waits for the preview to stop answering", async () => {
    const h = harness({ previewAnswers: 2 })
    expect(await main(["close", "--delete-preview"], ENV, h.deps)).toBe(0)
    const checks = h.calls.filter((c) => c.url.startsWith("https://pr-42.pragmaticpapers.com/"))
    expect(checks).toHaveLength(3)
    expect(checks[0]).toMatchObject({ method: "HEAD" })
    expect(h.logs.join("\n")).toContain("no longer answers")
  })

  it("fails when the preview keeps answering after Coolify's delete", async () => {
    const h = harness({ previewAnswers: Infinity })
    expect(await main(["close", "--delete-preview"], ENV, h.deps)).toBe(1)
    expect(h.logs.join("\n")).toContain("still answers at https://pr-42.pragmaticpapers.com")
    // The PR's deployments are retired before the check, so they don't stay active.
    expect(h.statuses().map((s) => s.id)).toEqual([100])
    expect(h.elapsed()).toBeLessThanOrEqual(5 * 60_000)
  })

  it("fails when Coolify has no preview but one still answers", async () => {
    const h = harness({ deleteStatus: 404, previewAnswers: Infinity })
    expect(await main(["close", "--delete-preview"], ENV, h.deps)).toBe(1)
  })

  it("leaves Coolify and the preview alone without the flag", async () => {
    const h = harness({ previewAnswers: Infinity })
    expect(await main(["close"], ENV, h.deps)).toBe(0)
    expect(h.calls.some((c) => c.url.startsWith("https://coolify.test/"))).toBe(false)
    expect(h.calls.some((c) => c.url.startsWith("https://pr-42."))).toBe(false)
  })

  it("rejects an unknown flag", async () => {
    expect(await main(["close", "--drop"], ENV, harness().deps)).toBe(2)
  })
})

describe("the entry point", () => {
  // The workflows run the file with plain `node`, which only strips types: syntax that needs
  // compiling (a constructor parameter property, say) passes the tests above but not this.
  it("runs under plain node, skipping without Coolify settings", () => {
    const result = spawnSync(
      process.execPath,
      [resolve(__dirname, "../../scripts/preview-deployment.ts"), "deploy"],
      { encoding: "utf-8", env: { ...process.env, COOLIFY_DASHBOARD_URL: "" } },
    )
    expect(result.stderr).not.toContain("ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX")
    expect(result.stdout).toContain("skipping")
    expect(result.status).toBe(0)
  })
})
