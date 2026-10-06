/**
 * Mirrors a PR's Coolify preview deploy into a GitHub Deployment, so the PR
 * shows the preview's state and a "View deployment" link to it.
 *
 * Coolify builds previews itself (on its GitHub App's webhook) but never tells
 * GitHub about them: it only posts a PR comment
 * (https://github.com/coollabsio/coolify/issues/9583). Run by
 * .github/workflows/preview-deployment.yml under plain Node 24, with:
 *
 *   node scripts/preview-deployment.ts deploy   # PR opened, reopened or pushed
 *   node scripts/preview-deployment.ts close    # PR closed or merged
 *
 * `deploy` waits for Coolify to queue a preview for the PR's head commit, then
 * creates a Deployment for the PR's branch in the "Preview" environment and
 * copies Coolify's status onto it until the build finishes. The branch (not the
 * commit SHA) is the Deployment's ref, which is what ties it to the PR. When the
 * build succeeds, the PR's older preview Deployments are marked inactive.
 * `close` marks all of the PR's preview Deployments inactive, since Coolify
 * tears the preview down.
 *
 * The workflow only runs `deploy` on PRs Coolify previews (see its `if`). A PR
 * Coolify still doesn't build (previews off for its base branch, say) gets no
 * Deployment. Without the Coolify settings the script does nothing.
 *
 * Previews built in GitHub Actions instead (#1067; deployed by .github/workflows/playwright.yml,
 * removed by .github/workflows/preview-image.yml)
 * run on a Coolify "Docker Image" application, which never builds anything itself:
 *
 *   node scripts/preview-deployment.ts deploy <image-tag>   # deploy that image as the PR's preview
 *   node scripts/preview-deployment.ts close --delete-preview
 *
 * `deploy <image-tag>` asks Coolify to deploy the tag as PR n's preview (creating the
 * preview on its first deploy), then follows that deployment, not the newest one it
 * can find for the commit. `close --delete-preview` also removes the preview from
 * Coolify, which nothing else does for an image application (there's no GitHub App
 * watching the PR). Both need a token with the `deploy` and `write` abilities.
 */
import { pathToFileURL } from "node:url"

export const ENVIRONMENT = "Preview"
export const DEFAULT_PREVIEW_URL_TEMPLATE = "https://pr-{{pr_id}}.pragmaticpapers.com"

export interface Config {
  repo: string
  githubToken: string
  pr: number
  headRef: string
  headSha: string
  /** Ignore Coolify deploys queued before this (epoch ms); see readConfig. */
  since?: number
  coolifyUrl: string
  coolifyToken: string
  coolifyAppUuid: string
  previewUrlTemplate: string
}

/** What `deploy` and `close` do on top of mirroring, for an image-built preview. */
export interface ImageOptions {
  /** The image tag to deploy as the PR's preview. */
  dockerTag?: string
  /** Remove the PR's preview from Coolify. */
  deletePreview?: boolean
}

/** One row of Coolify's `GET /api/v1/deployments/applications/{uuid}`. */
export interface CoolifyDeployment {
  deployment_uuid: string
  pull_request_id: number
  commit: string
  status: string
  deployment_url?: string | null
  created_at?: string
}

/** The workflow's env; not NodeJS.ProcessEnv, which the app's typings narrow. */
export type Env = Record<string, string | undefined>

export type GithubState = "queued" | "in_progress" | "success" | "failure" | "error" | "inactive"

export interface Deps {
  fetch: typeof fetch
  sleep: (ms: number) => Promise<void>
  now: () => number
  log: (message: string) => void
}

export interface Timing {
  /** How often Coolify is polled. */
  pollMs: number
  /** How long to wait for Coolify to queue a preview for the commit. */
  queueTimeoutMs: number
  /** How long the build may take once queued. */
  buildTimeoutMs: number
}

export const TIMING: Timing = {
  pollMs: 15_000,
  queueTimeoutMs: 10 * 60_000,
  buildTimeoutMs: 45 * 60_000,
}

const COOLIFY_STATES: Record<string, { state: GithubState; description: string }> = {
  queued: { state: "queued", description: "Queued in Coolify" },
  in_progress: { state: "in_progress", description: "Building in Coolify" },
  finished: { state: "success", description: "Preview is live" },
  failed: { state: "failure", description: "Coolify build failed" },
  "cancelled-by-user": { state: "inactive", description: "Cancelled in Coolify" },
}

/** The GitHub state for a Coolify status, or null for one it doesn't know. */
export function toGithubState(status: string): { state: GithubState; description: string } | null {
  return COOLIFY_STATES[status] ?? null
}

export function isFinal(state: GithubState): boolean {
  return state !== "queued" && state !== "in_progress"
}

/** Coolify's own preview URL template syntax, so the same value works in both. */
export function previewUrl(template: string, pr: number): string {
  return template.replaceAll("{{pr_id}}", String(pr))
}

/**
 * Coolify lists newest first, so the first match is the latest deploy of the
 * commit. Deploys queued before `since` belong to an earlier event.
 */
export function findDeployment(
  deployments: CoolifyDeployment[],
  pr: number,
  sha: string,
  since?: number,
): CoolifyDeployment | undefined {
  return deployments.find(
    (d) =>
      Number(d.pull_request_id) === pr &&
      d.commit === sha &&
      !(since && d.created_at && Date.parse(d.created_at) < since),
  )
}

/** Allowance for clock skew between GitHub and the Coolify server. */
export const CLOCK_SKEW_MS = 2 * 60_000

/**
 * Reads the workflow's environment. Returns null when the Coolify settings are
 * missing, which means "not set up here" rather than an error.
 */
export function readConfig(env: Env): Config | null {
  // The server's base URL; a value saved with the API path on the end works too.
  const coolifyUrl =
    env.COOLIFY_DASHBOARD_URL?.trim()
      .replace(/\/+$/, "")
      .replace(/\/api(\/v1)?$/, "") ?? ""
  const coolifyToken = env.COOLIFY_API_TOKEN?.trim() ?? ""
  const coolifyAppUuid = env.COOLIFY_PREVIEW_APP_UUID?.trim() ?? ""
  if (!coolifyUrl || !coolifyToken || !coolifyAppUuid) return null

  const required = (name: string): string => {
    const value = env[name]?.trim()
    if (!value) throw new Error(`Missing required env var ${name}`)
    return value
  }
  const pr = Number(required("PR_NUMBER"))
  if (!Number.isInteger(pr) || pr <= 0)
    throw new Error(`PR_NUMBER must be a PR number, got "${env.PR_NUMBER}"`)

  return {
    repo: required("GITHUB_REPOSITORY"),
    githubToken: required("GITHUB_TOKEN"),
    pr,
    headRef: required("HEAD_REF"),
    headSha: required("HEAD_SHA"),
    // When the PR was last pushed or reopened. Reopening at the same commit
    // would otherwise match the deploy from before the PR was closed.
    since: env.EVENT_AT ? Date.parse(env.EVENT_AT) - CLOCK_SKEW_MS || undefined : undefined,
    coolifyUrl,
    coolifyToken,
    coolifyAppUuid,
    previewUrlTemplate: env.PREVIEW_URL_TEMPLATE?.trim() || DEFAULT_PREVIEW_URL_TEMPLATE,
  }
}

/** HTTP 4xx other than rate limits: retrying won't help. */
export class FatalHttpError extends Error {
  // A plain field, not a constructor parameter property: the workflows run this file
  // under Node's type stripping, which rejects parameter properties.
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  deps: Deps,
  url: string,
  init: RequestInit & { token: string; github?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: init.github ? "application/vnd.github+json" : "application/json",
    Authorization: `Bearer ${init.token}`,
  }
  if (init.github) headers["X-GitHub-Api-Version"] = "2022-11-28"
  if (init.body) headers["Content-Type"] = "application/json"

  const res = await deps.fetch(url, { method: init.method, body: init.body, headers })
  if (!res.ok) {
    const text = (await res.text()).slice(0, 500)
    const message = `${init.method ?? "GET"} ${url} → ${res.status}: ${text}`
    if (res.status >= 400 && res.status < 500 && res.status !== 429)
      throw new FatalHttpError(message, res.status)
    throw new Error(message)
  }
  return (await res.json()) as T
}

interface Status {
  state: GithubState
  description: string
  environment_url?: string
}

export interface GithubApi {
  createDeployment: (description: string) => Promise<{ id: number; sha: string }>
  setStatus: (id: number, status: Status) => Promise<unknown>
  listDeployments: () => Promise<{ id: number }[]>
  latestState: (id: number) => Promise<GithubState | undefined>
}

export function github(deps: Deps, config: Config): GithubApi {
  const base = `https://api.github.com/repos/${config.repo}`
  const call = <T>(path: string, method = "GET", body?: unknown) =>
    request<T>(deps, `${base}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      token: config.githubToken,
      github: true,
    })

  return {
    createDeployment: (description: string) =>
      call<{ id: number; sha: string }>("/deployments", "POST", {
        ref: config.headRef,
        environment: ENVIRONMENT,
        description,
        auto_merge: false,
        // Coolify builds regardless of CI, so don't wait on (or fail for) checks.
        required_contexts: [],
        transient_environment: true,
        production_environment: false,
        payload: { pr: config.pr },
      }),
    setStatus: (id, status) =>
      call<unknown>(`/deployments/${id}/statuses`, "POST", {
        ...status,
        environment: ENVIRONMENT,
        // Deployments are transient, and other PRs share the environment:
        // this PR's older ones are marked inactive by hand instead.
        auto_inactive: false,
      }),
    listDeployments: () =>
      call<{ id: number }[]>(
        `/deployments?environment=${encodeURIComponent(ENVIRONMENT)}&ref=${encodeURIComponent(config.headRef)}&per_page=100`,
      ),
    latestState: async (id: number) => {
      const statuses = await call<{ state: GithubState }[]>(
        `/deployments/${id}/statuses?per_page=1`,
      )
      return statuses[0]?.state
    },
  }
}

export interface CoolifyApi {
  listDeployments: () => Promise<CoolifyDeployment[]>
  getDeployment: (uuid: string) => Promise<CoolifyDeployment | undefined>
  /** Queues `tag` as the PR's preview and returns the deployment's UUID. */
  deployImage: (tag: string) => Promise<string>
  /** Removes the PR's preview; false when it was already gone. */
  deletePreview: () => Promise<boolean>
}

export function coolify(deps: Deps, config: Config): CoolifyApi {
  const api = `${config.coolifyUrl}/api/v1`
  const app = encodeURIComponent(config.coolifyAppUuid)
  const call = <T>(path: string, method = "GET") =>
    request<T>(deps, `${api}${path}`, { method, token: config.coolifyToken })

  return {
    listDeployments: async () => {
      const body = await call<{ deployments: CoolifyDeployment[] }>(
        `/deployments/applications/${app}?take=50`,
      )
      return body.deployments ?? []
    },
    getDeployment: async (uuid) => {
      try {
        return await call<CoolifyDeployment>(`/deployments/${encodeURIComponent(uuid)}`)
      } catch (err) {
        // Coolify hands back the UUID before the deployment can be read by it, so the
        // first polls can 404. Not found yet, not fatal: poll() retries until its
        // deadline. A bad token or app UUID has already failed the deploy request.
        if (err instanceof FatalHttpError && err.status === 404) return undefined
        throw err
      }
    },
    deployImage: async (tag) => {
      // POST: current Coolify answers GET /deploy with "use POST". It reads the
      // parameters from the query string either way.
      const query = new URLSearchParams({
        uuid: config.coolifyAppUuid,
        pr: String(config.pr),
        docker_tag: tag,
      })
      const body = await call<{ deployments?: { message?: string; deployment_uuid?: string }[] }>(
        `/deploy?${query}`,
        "POST",
      )
      const [queued] = body.deployments ?? []
      if (!queued?.deployment_uuid) {
        throw new Error(`Coolify didn't queue ${tag}: ${queued?.message ?? JSON.stringify(body)}`)
      }
      return queued.deployment_uuid
    },
    deletePreview: async () => {
      try {
        await call<unknown>(`/applications/${app}/previews/${config.pr}`, "DELETE")
        return true
      } catch (err) {
        if (err instanceof FatalHttpError && err.status === 404) return false
        throw err
      }
    },
  }
}

/** Marks every preview Deployment for the PR's branch inactive, except `keep`. */
export async function deactivate(deps: Deps, config: Config, keep?: number): Promise<number> {
  const gh = github(deps, config)
  let count = 0
  for (const { id } of await gh.listDeployments()) {
    if (id === keep) continue
    if ((await gh.latestState(id)) === "inactive") continue
    await gh.setStatus(id, { state: "inactive", description: "Superseded or closed" })
    count++
  }
  return count
}

/**
 * Polls Coolify with `find` until it returns the deploy. A failed poll is retried
 * until the deadline; a 4xx (bad token, wrong app UUID) is thrown at once.
 */
async function poll(
  deps: Deps,
  timing: Timing,
  deadline: number,
  find: () => Promise<CoolifyDeployment | undefined>,
): Promise<CoolifyDeployment | undefined> {
  for (;;) {
    try {
      const found = await find()
      if (found) return found
    } catch (err) {
      if (err instanceof FatalHttpError) throw err
      deps.log(`Coolify poll failed, retrying: ${(err as Error).message}`)
    }
    if (deps.now() + timing.pollMs > deadline) return undefined
    await deps.sleep(timing.pollMs)
  }
}

export async function deploy(
  deps: Deps,
  config: Config,
  timing: Timing = TIMING,
  { dockerTag }: ImageOptions = {},
): Promise<void> {
  const short = config.headSha.slice(0, 7)
  const api = coolify(deps, config)
  let find = async () =>
    findDeployment(await api.listDeployments(), config.pr, config.headSha, config.since)
  if (dockerTag) {
    const uuid = await api.deployImage(dockerTag)
    deps.log(`Coolify queued ${dockerTag} as PR #${config.pr}'s preview (deployment ${uuid}).`)
    find = () => api.getDeployment(uuid)
  }

  let current = await poll(deps, timing, deps.now() + timing.queueTimeoutMs, find)
  if (!current) {
    deps.log(
      `Coolify didn't queue a preview for PR #${config.pr} at ${short} within ${timing.queueTimeoutMs / 60_000} min. ` +
        "Previews may be off for this PR's base branch; no Deployment created.",
    )
    return
  }

  const gh = github(deps, config)
  const deployment = await gh.createDeployment(`Coolify preview for PR #${config.pr}`)
  if (deployment.sha !== config.headSha) {
    // The branch moved on between the push and now; the newer push's run owns it.
    await gh.setStatus(deployment.id, { state: "inactive", description: "Branch moved on" })
    deps.log(
      `Branch ${config.headRef} is at ${deployment.sha.slice(0, 7)}, not ${short}; leaving it to that run.`,
    )
    return
  }

  const environmentUrl = previewUrl(config.previewUrlTemplate, config.pr)
  const buildDeadline = deps.now() + timing.buildTimeoutMs
  let posted: string | undefined
  for (;;) {
    const mapped = toGithubState(current.status) ?? {
      state: "in_progress" as const,
      description: `Coolify status: ${current.status}`,
    }
    if (mapped.state !== posted) {
      // No log_url: statuses are public on this repo, and it would publish the
      // Coolify dashboard's address on every PR.
      await gh.setStatus(deployment.id, {
        ...mapped,
        ...(mapped.state === "success" && { environment_url: environmentUrl }),
      })
      posted = mapped.state
      deps.log(`Deployment ${deployment.id}: ${mapped.state} (Coolify: ${current.status})`)
    }

    if (isFinal(mapped.state)) {
      if (mapped.state === "success") {
        const n = await deactivate(deps, config, deployment.id)
        if (n) deps.log(`Marked ${n} older preview deployment(s) inactive.`)
      }
      return
    }

    if (deps.now() + timing.pollMs > buildDeadline) {
      await gh.setStatus(deployment.id, {
        state: "error",
        description: `No result from Coolify after ${timing.buildTimeoutMs / 60_000} min`,
      })
      deps.log("Timed out waiting for the Coolify build.")
      return
    }
    await deps.sleep(timing.pollMs)
    // The deploy was seen already, so a missing row now means Coolify pruned
    // it; keep the last known state and let the build deadline end the wait.
    current = (await poll(deps, timing, deps.now(), find)) ?? current
  }
}

export async function close(
  deps: Deps,
  config: Config,
  { deletePreview }: ImageOptions = {},
): Promise<void> {
  if (deletePreview) {
    const deleted = await coolify(deps, config).deletePreview()
    deps.log(
      deleted
        ? `Asked Coolify to remove PR #${config.pr}'s preview.`
        : `Coolify has no preview for PR #${config.pr}.`,
    )
  }
  const n = await deactivate(deps, config)
  deps.log(`Marked ${n} preview deployment(s) for PR #${config.pr} inactive.`)
}

const defaultDeps: Deps = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  log: (message) => process.stdout.write(`${message}\n`),
}

export async function main(
  argv: string[],
  env: Env = process.env,
  deps: Deps = defaultDeps,
): Promise<number> {
  const [mode, arg] = argv
  const options: ImageOptions | null =
    mode === "deploy" && !arg?.startsWith("-")
      ? { dockerTag: arg }
      : mode === "close" && (arg === undefined || arg === "--delete-preview")
        ? { deletePreview: arg === "--delete-preview" }
        : null
  if (!options) {
    deps.log(
      "Usage: node scripts/preview-deployment.ts deploy [image-tag] | close [--delete-preview]",
    )
    return 2
  }
  try {
    const config = readConfig(env)
    if (!config) {
      deps.log(
        "Coolify isn't configured for this run (COOLIFY_DASHBOARD_URL, COOLIFY_API_TOKEN, COOLIFY_PREVIEW_APP_UUID); skipping.",
      )
      return 0
    }
    await (mode === "deploy" ? deploy(deps, config, TIMING, options) : close(deps, config, options))
    return 0
  } catch (err) {
    deps.log(`::error::${(err as Error).message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2))
}
