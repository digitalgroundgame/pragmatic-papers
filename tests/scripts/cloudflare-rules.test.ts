import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  type Deps,
  describePlan,
  inSync,
  type LiveRule,
  main,
  parseRuleset,
  plan,
  fromLive,
  RULESETS_DIR,
} from "../../scripts/cloudflare-rules"

const PHASE = "http_request_cache_settings"
const PATH = `${RULESETS_DIR}/${PHASE}.json`
const ENV = { CLOUDFLARE_ZONE_ID: "zone", CLOUDFLARE_RULES_TOKEN: "token" }

const live = (overrides: Partial<LiveRule> = {}): LiveRule => ({
  id: "abc123",
  ref: "abc123",
  description: "cache static page",
  expression: '(not starts_with(http.request.uri.path, "/admin"))',
  action: "set_cache_settings",
  action_parameters: { cache: true, edge_ttl: { mode: "bypass_by_default" } },
  enabled: true,
  ...overrides,
})

const file = (rules: unknown[]) => JSON.stringify({ rules })

const fileRule = {
  description: "cache static page",
  expression: ["(not starts_with(http.request.uri.path,", '"/admin"))'],
  action: "set_cache_settings",
  action_parameters: { edge_ttl: { mode: "bypass_by_default" }, cache: true },
}

/** Fakes the Rulesets API: GET returns `rules` (404 when null), PUT records its body. */
function fakeDeps(rules: LiveRule[] | null, files: Record<string, string>) {
  const logs: string[] = []
  const puts: unknown[] = []
  const written: Record<string, string> = {}
  const deps: Deps = {
    fetch: (async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        puts.push(JSON.parse(init.body as string))
        return Response.json({ success: true, result: { rules: [] } })
      }
      if (rules === null) return Response.json({ success: false, errors: [] }, { status: 404 })
      return Response.json({ success: true, result: { rules } })
    }) as typeof fetch,
    log: (message) => logs.push(message),
    summary: () => undefined,
    readDir: () => Object.keys(files).map((path) => path.slice(RULESETS_DIR.length + 1)),
    readFile: (path) => files[path]!,
    writeFile: (path, contents) => {
      written[path] = contents
    },
  }
  return { deps, logs, puts, written }
}

describe("parseRuleset", () => {
  it("joins a split expression with spaces and enables rules by default", () => {
    const [rule] = parseRuleset(PHASE, file([fileRule]))
    expect(rule).toMatchObject({
      expression: '(not starts_with(http.request.uri.path, "/admin"))',
      enabled: true,
    })
  })

  it("rejects two rules with the same description, since that's how rules are matched", () => {
    expect(() => parseRuleset(PHASE, file([fileRule, fileRule]))).toThrow(/two rules are named/)
  })

  it("rejects a rule without a description", () => {
    expect(() => parseRuleset(PHASE, file([{ ...fileRule, description: "" }]))).toThrow(
      /has no description/,
    )
  })

  it("parses the committed cache rules", () => {
    const rules = parseRuleset(PHASE, readFileSync(PATH, "utf8"))
    expect(rules.map((rule) => rule.description)).toEqual(["cache static page"])
    expect(rules[0]!.expression).toContain('http.host ne "list.pragmaticpapers.com"')
  })
})

describe("plan", () => {
  it("is in sync when only key order differs, and keeps the live rule's ref", () => {
    const p = plan(parseRuleset(PHASE, file([fileRule])), [fromLive(live())])
    expect(inSync(p)).toBe(true)
    expect(p.body.rules[0]).toMatchObject({ ref: "abc123", description: "cache static page" })
    expect(describePlan(p)).toEqual(["  in sync"])
  })

  it("names the fields that changed", () => {
    const p = plan(parseRuleset(PHASE, file([fileRule])), [
      fromLive(live({ action_parameters: { cache: true, edge_ttl: { mode: "respect_origin" } } })),
    ])
    expect(p.changed).toEqual([
      {
        description: "cache static page",
        fields: [
          {
            field: "action_parameters",
            before: '{"cache":true,"edge_ttl":{"mode":"respect_origin"}}',
            after: '{"cache":true,"edge_ttl":{"mode":"bypass_by_default"}}',
          },
        ],
      },
    ])
  })

  it("reports rules only in the file, rules only in Cloudflare, and a new order", () => {
    const a = { ...fileRule, description: "a" }
    const b = { ...fileRule, description: "b" }
    const p = plan(parseRuleset(PHASE, file([b, a, { ...fileRule, description: "new" }])), [
      fromLive(live({ id: "1", ref: "1", description: "a" })),
      fromLive(live({ id: "2", ref: "2", description: "b" })),
      fromLive(live({ id: "3", ref: "3", description: "dashboard only" })),
    ])
    expect(p.added).toEqual(["new"])
    expect(p.unmanaged).toEqual(["dashboard only"])
    expect(p.reordered).toBe(true)
    expect(describePlan(p)).toEqual([
      "+ new",
      "- dashboard only (only in Cloudflare)",
      "~ rule order",
    ])
  })
})

describe("main", () => {
  it("apply sends nothing when Cloudflare already matches", async () => {
    const { deps, puts } = fakeDeps([live()], { [PATH]: file([fileRule]) })
    expect(await main(["apply"], ENV, deps)).toBe(0)
    expect(puts).toEqual([])
  })

  it("apply replaces the ruleset with the file's rules, keeping refs", async () => {
    const { deps, puts } = fakeDeps([live({ expression: "(true)" })], { [PATH]: file([fileRule]) })
    expect(await main(["apply"], ENV, deps)).toBe(0)
    expect(puts).toEqual([
      {
        rules: [
          {
            ref: "abc123",
            description: "cache static page",
            expression: '(not starts_with(http.request.uri.path, "/admin"))',
            action: "set_cache_settings",
            action_parameters: { edge_ttl: { mode: "bypass_by_default" }, cache: true },
            enabled: true,
          },
        ],
      },
    ])
  })

  it("apply refuses to delete a dashboard-only rule without --prune", async () => {
    const rules = [live(), live({ id: "x", ref: "x", description: "dashboard only" })]
    const blocked = fakeDeps(rules, { [PATH]: file([fileRule]) })
    expect(await main(["apply"], ENV, blocked.deps)).toBe(1)
    expect(blocked.puts).toEqual([])
    expect(blocked.logs.join("\n")).toMatch(/"dashboard only" exist only in Cloudflare/)

    const pruned = fakeDeps(rules, { [PATH]: file([fileRule]) })
    expect(await main(["apply", "--prune"], ENV, pruned.deps)).toBe(0)
    expect(pruned.puts).toHaveLength(1)
  })

  it("check fails on drift and passes in sync; plan never fails", async () => {
    const drifted = fakeDeps([], { [PATH]: file([fileRule]) })
    expect(await main(["check"], ENV, drifted.deps)).toBe(1)
    expect(await main(["plan"], ENV, drifted.deps)).toBe(0)
    expect(await main(["check"], ENV, fakeDeps([live()], { [PATH]: file([fileRule]) }).deps)).toBe(
      0,
    )
  })

  it("treats a phase with no entrypoint as having no rules", async () => {
    const { deps } = fakeDeps(null, { [PATH]: file([]) })
    expect(await main(["check"], ENV, deps)).toBe(0)
  })

  it("export writes Cloudflare's rules, keeping the file's line breaks", async () => {
    const { deps, written } = fakeDeps([live({ enabled: false })], { [PATH]: file([fileRule]) })
    expect(await main(["export"], ENV, deps)).toBe(0)
    expect(JSON.parse(written[PATH]!)).toEqual({
      rules: [{ ...fileRule, action_parameters: live().action_parameters, enabled: false }],
    })
  })

  it("needs the zone and token", async () => {
    const { deps, logs } = fakeDeps([], { [PATH]: file([fileRule]) })
    expect(await main(["plan"], {}, deps)).toBe(1)
    expect(logs).toContain("::error::Missing required env var CLOUDFLARE_ZONE_ID")
  })
})
