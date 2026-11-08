import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "../..")
const WORKFLOW = ".github/workflows/playwright.yml"
const STEP = "Plan the preview"

const lines = () => readFileSync(join(ROOT, WORKFLOW), "utf8").split("\n")

/** The indented block under `key:` in the step named `name`. */
function stepBlock(name: string, key: "run" | "CANDIDATE"): string {
  const all = lines()
  const start = all.findIndex((line) => line.trim() === `- name: ${name}`)
  expect(start, `no step named "${name}" in ${WORKFLOW}`).toBeGreaterThan(-1)
  const end = all.findIndex((line, i) => i > start && line.trim().startsWith("- "))
  const keyLine = all.findIndex(
    (line, i) => i > start && (end === -1 || i < end) && line.trim().startsWith(`${key}: `),
  )
  expect(keyLine, `no ${key} in "${name}"`).toBeGreaterThan(-1)
  const indent = all[keyLine + 1]!.search(/\S/)
  const body: string[] = []
  for (const line of all.slice(keyLine + 1)) {
    if (line.trim() !== "" && line.search(/\S/) < indent) break
    body.push(line.slice(indent))
  }
  return body.join("\n").trim()
}

describe(`${WORKFLOW}: who gets a preview`, () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "preview-plan-"))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  /**
   * Runs the step's script with a `gh` that answers the permission lookup
   * with `permission` (or fails, for `null`), and returns its outputs.
   */
  function plan(options: {
    permission: string | null
    candidate?: boolean
    imageApp?: string
    stagingApp?: string
  }) {
    const gh = join(dir, "gh")
    const answer =
      options.permission === null ? `echo "HTTP 403" >&2\nexit 1` : `echo "${options.permission}"`
    writeFileSync(gh, `#!/bin/sh\nfor a in "$@"; do echo "$a"; done > "${dir}/args"\n${answer}\n`)
    chmodSync(gh, 0o755)
    const output = join(dir, "output")
    writeFileSync(output, "")
    const result = spawnSync("bash", ["-e", "-c", stepBlock(STEP, "run")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        GITHUB_OUTPUT: output,
        GITHUB_REPOSITORY: "Owner/repo",
        CANDIDATE: String(options.candidate ?? true),
        AUTHOR: "someone",
        IMAGE_APP: options.imageApp ?? "image-app",
        STAGING_APP: options.stagingApp ?? "staging-app",
        PR: "42",
        SHA: "0123456789abcdef0123",
        OWNER: "Owner",
      },
    })
    expect(result.status, result.stderr).toBe(0)
    const args = existsSync(join(dir, "args"))
      ? readFileSync(join(dir, "args"), "utf8").trim().split("\n")
      : null
    return { outputs: readFileSync(output, "utf8").trim(), stdout: result.stdout, args }
  }

  it("asks the API whether the author can push, not the event's author_association", () => {
    const candidate = stepBlock(STEP, "CANDIDATE")
    expect(candidate).not.toContain("author_association")
    expect(candidate).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    )
    expect(candidate).toContain("github.event.pull_request.user.type != 'Bot'")

    const { args } = plan({ permission: "write" })
    expect(args).toEqual([
      "api",
      "repos/Owner/repo/collaborators/someone/permission",
      "--jq",
      ".permission",
    ])
  })

  it("previews the image for authors who can push", () => {
    for (const permission of ["admin", "write"]) {
      expect(plan({ permission }).outputs).toBe(
        [
          "preview=image",
          "image=ghcr.io/owner/pragmatic-papers-preview",
          "tag=pr-42-0123456789ab",
        ].join("\n"),
      )
    }
  })

  it("falls back to Coolify's own previews without the image app", () => {
    expect(plan({ permission: "write", imageApp: "" }).outputs).toBe("preview=coolify")
    expect(plan({ permission: "write", imageApp: "", stagingApp: "" }).outputs).toBe("")
  })

  it("gives no preview to authors who can't push, or when the lookup fails", () => {
    for (const permission of ["read", "none", "", null]) {
      const { outputs, stdout } = plan({ permission })
      expect(outputs, String(permission)).toBe("")
      expect(stdout).toContain("::notice::No preview: someone can't push to Owner/repo")
    }
  })

  it("doesn't look anyone up for forks, bots or [skip ci] PRs", () => {
    const { outputs, args } = plan({ permission: "admin", candidate: false })
    expect(outputs).toBe("")
    expect(args).toBeNull()
  })
})
