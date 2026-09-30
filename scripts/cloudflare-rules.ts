/**
 * Keeps the zone's Cloudflare rules in lockstep with `cloudflare/rulesets/`, one
 * file per ruleset phase (`http_request_cache_settings.json` holds the Cache
 * Rules). Run under plain Node 24 (no install needed) by
 * .github/workflows/cloudflare-rules.yml, or locally:
 *
 *   node scripts/cloudflare-rules.ts plan              # print what `apply` would change
 *   node scripts/cloudflare-rules.ts check             # the same, but exit 1 when anything differs
 *   node scripts/cloudflare-rules.ts apply [--prune]   # make Cloudflare match the files
 *   node scripts/cloudflare-rules.ts export [phase...] # write Cloudflare's rules into the files
 *
 * Needs CLOUDFLARE_ZONE_ID and CLOUDFLARE_RULES_TOKEN: a Cache Rules Read token does for
 * everything but `apply`, which needs Edit (see cloudflare/README.md).
 *
 * A phase's rules are one ruleset (its "entrypoint"), and `apply` replaces it
 * whole. So a rule is known by its description (the dashboard's "Rule name"),
 * which must be unique in its file, and `apply` refuses to delete a rule that is
 * only in Cloudflare (someone added it in the dashboard) unless given --prune:
 * `export` it into the file instead. `apply` sends each rule Cloudflare already
 * has with its `ref`, so it keeps its identity and analytics.
 */
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const RULESETS_DIR = "cloudflare/rulesets"

const API = "https://api.cloudflare.com/client/v4"
const PHASE = /^[a-z_]+$/

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** A rule as a file holds it. A long expression can be split into lines, joined with spaces. */
export interface FileRule {
  description: string
  expression: string | string[]
  action: string
  action_parameters?: Json
  /** Omitted means enabled. */
  enabled?: boolean
}

/** A rule as Cloudflare's Rulesets API returns it. */
export interface LiveRule {
  id: string
  ref?: string
  description?: string
  expression: string
  action: string
  action_parameters?: Json
  enabled?: boolean
}

/** A rule in the form both sides are compared in, and sent back in. */
export interface Rule {
  ref?: string
  description: string
  expression: string
  action: string
  action_parameters?: Json
  enabled: boolean
}

export interface FieldChange {
  field: string
  before: string
  after: string
}

export interface Plan {
  /** In the file, not in Cloudflare. */
  added: string[]
  changed: { description: string; fields: FieldChange[] }[]
  /** In Cloudflare, not in the file. */
  unmanaged: string[]
  /** The rules both sides have run in a different order. */
  reordered: boolean
  /** The PUT body that makes Cloudflare match the file. */
  body: { rules: Rule[] }
}

export type Env = Record<string, string | undefined>

export interface Deps {
  fetch: typeof fetch
  log: (message: string) => void
  /** Adds to the job summary (GITHUB_STEP_SUMMARY). */
  summary: (markdown: string) => void
  readDir: (path: string) => string[]
  readFile: (path: string) => string
  writeFile: (path: string, contents: string) => void
}

function required(env: Env, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing required env var ${name}`)
  return value
}

/** JSON with every object's keys sorted, so key order never counts as a change. */
export function stable(value: Json | undefined): string {
  const sort = (v: Json): Json =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((key) => [key, sort(v[key]!)]),
          )
        : v
  return value === undefined ? "(none)" : JSON.stringify(sort(value))
}

export function fromFile(rule: FileRule): Rule {
  return {
    description: rule.description,
    expression: Array.isArray(rule.expression) ? rule.expression.join(" ") : rule.expression,
    action: rule.action,
    ...(rule.action_parameters !== undefined && { action_parameters: rule.action_parameters }),
    enabled: rule.enabled ?? true,
  }
}

export function fromLive(rule: LiveRule): Rule {
  return {
    ref: rule.ref ?? rule.id,
    description: rule.description ?? "",
    expression: rule.expression,
    action: rule.action,
    ...(rule.action_parameters !== undefined && { action_parameters: rule.action_parameters }),
    enabled: rule.enabled ?? true,
  }
}

/** Throws on a file Cloudflare would reject, or one whose rules can't be told apart. */
export function parseRuleset(phase: string, contents: string): Rule[] {
  const where = `${RULESETS_DIR}/${phase}.json`
  const parsed = JSON.parse(contents) as { rules?: FileRule[] }
  if (!Array.isArray(parsed.rules)) throw new Error(`${where}: expected { "rules": [...] }`)
  const seen = new Set<string>()
  return parsed.rules.map((file, i) => {
    const rule = fromFile(file)
    if (!rule.description?.trim()) throw new Error(`${where}: rule ${i + 1} has no description`)
    if (seen.has(rule.description))
      throw new Error(`${where}: two rules are named "${rule.description}"`)
    seen.add(rule.description)
    if (!rule.expression?.trim())
      throw new Error(`${where}: "${rule.description}" has no expression`)
    if (!rule.action) throw new Error(`${where}: "${rule.description}" has no action`)
    return rule
  })
}

const label = (rule: Rule) => rule.description || `unnamed rule ${rule.ref}`

export function plan(desired: Rule[], live: Rule[]): Plan {
  const byName = new Map(live.map((rule) => [rule.description, rule]))
  const wanted = new Set(desired.map((rule) => rule.description))
  const added: string[] = []
  const changed: Plan["changed"] = []
  const rules = desired.map((rule) => {
    const current = byName.get(rule.description)
    if (!current) {
      added.push(rule.description)
      return rule
    }
    const fields: FieldChange[] = [
      { field: "expression", before: current.expression, after: rule.expression },
      { field: "action", before: current.action, after: rule.action },
      {
        field: "action_parameters",
        before: stable(current.action_parameters),
        after: stable(rule.action_parameters),
      },
      { field: "enabled", before: String(current.enabled), after: String(rule.enabled) },
    ].filter(({ before, after }) => before !== after)
    if (fields.length) changed.push({ description: rule.description, fields })
    return { ref: current.ref, ...rule }
  })
  const shared = (list: Rule[]) =>
    list.map((rule) => rule.description).filter((name) => wanted.has(name) && byName.has(name))
  return {
    added,
    changed,
    unmanaged: live.filter((rule) => !wanted.has(rule.description)).map(label),
    reordered: shared(desired).join("\n") !== shared(live).join("\n"),
    body: { rules },
  }
}

export const inSync = (p: Plan): boolean =>
  !p.added.length && !p.changed.length && !p.unmanaged.length && !p.reordered

/** The plan as diff lines: `+` only in the file, `-` only in Cloudflare, `~` changed. */
export function describePlan(p: Plan): string[] {
  if (inSync(p)) return ["  in sync"]
  return [
    ...p.added.map((name) => `+ ${name}`),
    ...p.changed.flatMap(({ description, fields }) => [
      `~ ${description}`,
      ...fields.flatMap(({ field, before, after }) => [
        `    ${field}:`,
        `-     ${before}`,
        `+     ${after}`,
      ]),
    ]),
    ...p.unmanaged.map((name) => `- ${name} (only in Cloudflare)`),
    ...(p.reordered ? ["~ rule order"] : []),
  ]
}

function cloudflare(deps: Deps, env: Env) {
  const zone = required(env, "CLOUDFLARE_ZONE_ID")
  const token = required(env, "CLOUDFLARE_RULES_TOKEN")
  async function call(method: "GET" | "PUT", phase: string, body?: unknown): Promise<LiveRule[]> {
    const res = await deps.fetch(`${API}/zones/${zone}/rulesets/phases/${phase}/entrypoint`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
    // A phase nobody has added a rule to has no entrypoint yet.
    if (method === "GET" && res.status === 404) return []
    const json = (await res.json().catch(() => null)) as {
      success?: boolean
      errors?: { code: number; message: string }[]
      result?: { rules?: LiveRule[] }
    } | null
    if (!res.ok || !json?.success) {
      const errors = json?.errors?.map((e) => `${e.code} ${e.message}`).join("; ")
      throw new Error(
        `Cloudflare ${method} ${phase}: HTTP ${res.status}${errors ? `: ${errors}` : ""}`,
      )
    }
    return json.result?.rules ?? []
  }
  return {
    rules: (phase: string) => call("GET", phase),
    put: (phase: string, body: Plan["body"]) => call("PUT", phase, body),
  }
}

function phasesOnDisk(deps: Deps): string[] {
  return deps
    .readDir(RULESETS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort()
}

async function plans(env: Env, deps: Deps) {
  const cf = cloudflare(deps, env)
  const phases = phasesOnDisk(deps)
  if (!phases.length) throw new Error(`No rulesets in ${RULESETS_DIR}`)
  const out: { phase: string; plan: Plan }[] = []
  for (const phase of phases) {
    const desired = parseRuleset(phase, deps.readFile(`${RULESETS_DIR}/${phase}.json`))
    const live = (await cf.rules(phase)).map(fromLive)
    out.push({ phase, plan: plan(desired, live) })
  }
  return { cf, plans: out }
}

function report(deps: Deps, title: string, results: { phase: string; plan: Plan }[]) {
  const sections = results.map(({ phase, plan: p }) => ({ phase, lines: describePlan(p) }))
  for (const { phase, lines } of sections) deps.log([`${phase}:`, ...lines].join("\n"))
  deps.summary(
    [
      `### ${title}`,
      ...sections.flatMap(({ phase, lines }) => [
        "",
        `\`${phase}\``,
        "",
        "```diff",
        ...lines,
        "```",
      ]),
    ].join("\n"),
  )
}

async function planCommand(env: Env, deps: Deps): Promise<number> {
  const { plans: results } = await plans(env, deps)
  report(deps, "Cloudflare rules: what apply would change", results)
  return 0
}

async function check(env: Env, deps: Deps): Promise<number> {
  const { plans: results } = await plans(env, deps)
  report(deps, "Cloudflare rules: drift", results)
  const drifted = results.filter(({ plan: p }) => !inSync(p)).map(({ phase }) => phase)
  if (!drifted.length) return 0
  deps.log(
    `::error::Cloudflare's ${drifted.join(", ")} rules differ from ${RULESETS_DIR}. Apply the files, or export the dashboard's change into them.`,
  )
  return 1
}

async function apply(env: Env, deps: Deps, args: string[]): Promise<number> {
  const prune = args.includes("--prune")
  const { cf, plans: results } = await plans(env, deps)
  report(deps, "Cloudflare rules: applied", results)
  const blocked = results.filter(({ plan: p }) => p.unmanaged.length && !prune)
  if (blocked.length) {
    for (const { phase, plan: p } of blocked)
      deps.log(
        `::error::${phase}: ${p.unmanaged.map((name) => `"${name}"`).join(", ")} exist only in Cloudflare, and applying would delete them. Run \`node scripts/cloudflare-rules.ts export\` and commit them, or pass --prune to delete them.`,
      )
    return 1
  }
  for (const { phase, plan: p } of results) {
    if (inSync(p)) continue
    await cf.put(phase, p.body)
    deps.log(`${phase}: applied ${p.body.rules.length} rule(s)`)
  }
  return 0
}

/** A live rule as a file holds it, keeping the file's line breaks when the expression hasn't changed. */
export function toFileRule(rule: Rule, previous?: FileRule): FileRule {
  const expression =
    Array.isArray(previous?.expression) && previous.expression.join(" ") === rule.expression
      ? previous.expression
      : rule.expression
  return {
    description: rule.description,
    expression,
    action: rule.action,
    ...(rule.action_parameters !== undefined && { action_parameters: rule.action_parameters }),
    ...(!rule.enabled && { enabled: false }),
  }
}

async function exportCommand(env: Env, deps: Deps, args: string[]): Promise<number> {
  const phases = args.length ? args : phasesOnDisk(deps)
  const bad = phases.filter((phase) => !PHASE.test(phase))
  if (bad.length) throw new Error(`Not a ruleset phase: ${bad.join(", ")}`)
  const cf = cloudflare(deps, env)
  const onDisk = new Set(phasesOnDisk(deps))
  for (const phase of phases) {
    const path = `${RULESETS_DIR}/${phase}.json`
    const previous = onDisk.has(phase)
      ? ((JSON.parse(deps.readFile(path)) as { rules?: FileRule[] }).rules ?? [])
      : []
    const live = (await cf.rules(phase)).map(fromLive)
    const rules = live.map((rule) =>
      toFileRule(
        rule,
        previous.find((p) => p.description === rule.description),
      ),
    )
    deps.writeFile(path, `${JSON.stringify({ rules }, null, 2)}\n`)
    deps.log(`${path}: ${rules.length} rule(s)`)
  }
  return 0
}

const USAGE =
  "Usage: node scripts/cloudflare-rules.ts plan | check | apply [--prune] | export [phase...]"

export async function main(argv: string[], env: Env, deps: Deps): Promise<number> {
  const [command, ...args] = argv
  try {
    switch (command) {
      case "plan":
        return await planCommand(env, deps)
      case "check":
        return await check(env, deps)
      case "apply":
        return await apply(env, deps, args)
      case "export":
        return await exportCommand(env, deps, args)
      default:
        deps.log(USAGE)
        return 2
    }
  } catch (err) {
    deps.log(`::error::${(err as Error).message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2), process.env, {
    fetch: (...args) => fetch(...args),
    log: (message) => process.stdout.write(`${message}\n`),
    summary: (markdown) => {
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
    },
    readDir: (path) => readdirSync(path),
    readFile: (path) => readFileSync(path, "utf8"),
    writeFile: (path, contents) => writeFileSync(path, contents),
  })
}
