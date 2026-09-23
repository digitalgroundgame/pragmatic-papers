import { afterEach, describe, expect, it, vi } from "vitest"

import { githubRepo } from "../github"
import { INTEGRATIONS, courtTracker, integrationStatuses } from "../index"
import { describeStatus, integrationStatus, type Integration } from "../types"

const repo = githubRepo({
  id: "github-example",
  label: "Example data feed",
  defaultRepo: "org/repo",
  repoEnv: "EXAMPLE_REPO",
  tokenEnv: "EXAMPLE_TOKEN",
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("integrationStatus", () => {
  it("reports the names of missing variables, and never a value", () => {
    vi.stubEnv("EXAMPLE_TOKEN", "")
    const status = integrationStatus(repo)
    expect(status).toMatchObject({
      id: "github-example",
      service: "GitHub",
      target: "github:org/repo",
      configured: false,
      missing: ["EXAMPLE_TOKEN"],
    })
    expect(JSON.stringify(status)).not.toContain("secret")
  })

  it("treats a variable set to whitespace as unset", () => {
    vi.stubEnv("EXAMPLE_TOKEN", "   ")
    expect(integrationStatus(repo).configured).toBe(false)
    vi.stubEnv("EXAMPLE_TOKEN", "ghp_secret")
    expect(integrationStatus(repo)).toMatchObject({ configured: true, missing: [] })
  })

  it("reads the environment on every call, so a status probe cannot go stale", () => {
    vi.stubEnv("EXAMPLE_TOKEN", "")
    expect(integrationStatus(repo).configured).toBe(false)
    vi.stubEnv("EXAMPLE_TOKEN", "ghp_secret")
    expect(integrationStatus(repo).configured).toBe(true)
  })

  it("lets a connection say that set is not the same as usable", () => {
    const fussy: Integration = {
      id: "fussy",
      label: "Fussy",
      service: "Test",
      describe: () => "test:fussy",
      required: ["EXAMPLE_TOKEN"],
      isConfigured: () => false,
    }
    vi.stubEnv("EXAMPLE_TOKEN", "set")
    expect(integrationStatus(fussy)).toMatchObject({ configured: false, missing: [] })
  })

  it("names what to set in a log line", () => {
    vi.stubEnv("EXAMPLE_TOKEN", "")
    expect(describeStatus(integrationStatus(repo))).toBe(
      "github:org/repo is not configured — set EXAMPLE_TOKEN",
    )
    vi.stubEnv("EXAMPLE_TOKEN", "ghp_secret")
    expect(describeStatus(integrationStatus(repo))).toBe("github:org/repo is configured")
  })
})

describe("githubRepo", () => {
  const ok = (body: unknown): Response =>
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "text/plain" } })

  it("reads the declared repository, or the override when one is set", () => {
    expect(repo.repo()).toBe("org/repo")
    vi.stubEnv("EXAMPLE_REPO", "org/fork")
    expect(repo.repo()).toBe("org/fork")
    expect(repo.describe()).toBe("github:org/fork")
  })

  it("hands its credential to every read, so nothing else has to carry it", async () => {
    vi.stubEnv("EXAMPLE_TOKEN", "ghp_secret")
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => ok("{}"))
    await repo.filesAt("v1", { fetchImpl: fetchImpl as unknown as typeof fetch }).read("a.json")
    await repo.latestRelease({
      tagPrefix: "data-v",
      fetchImpl: (async () => ok([])) as unknown as typeof fetch,
    })
    const [, init] = fetchImpl.mock.calls[0]!
    expect(init?.headers).toMatchObject({ Authorization: "Bearer ghp_secret" })
  })

  it("has no archive to offer when the release carries no such asset", async () => {
    const release = { tag: "data-v1", version: "1", assets: [{ name: "other.tar.gz", url: "u" }] }
    await expect(repo.filesFromRelease(release, "data-json.tar.gz")).resolves.toBeNull()
  })
})

describe("the declared connections", () => {
  it("gives every connection a distinct id", () => {
    const ids = INTEGRATIONS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("reports on all of them at once, which is what a status view needs", () => {
    const statuses = integrationStatuses()
    expect(statuses.map((s) => s.id)).toEqual(INTEGRATIONS.map((i) => i.id))
    for (const status of statuses) expect(status.target).not.toBe("")
  })

  it("points the court-tracker connection at the researcher's repository", () => {
    expect(courtTracker.describe()).toBe("github:digitalgroundgame/court-tracker")
    expect(courtTracker.required).toEqual(["COURT_TRACKER_GITHUB_TOKEN"])
  })
})
