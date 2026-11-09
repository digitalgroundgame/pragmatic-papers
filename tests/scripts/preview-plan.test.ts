import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "../..")
const WORKFLOW = ".github/workflows/playwright.yml"
const STEP = "Plan the preview"

const lines = () => readFileSync(join(ROOT, WORKFLOW), "utf8").split("\n")

/** The indented block under `key:` in the step named `name`. */
function stepBlock(name: string, key: "run" | "ELIGIBLE"): string {
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

interface Event {
  event?: string
  headRepo?: string
  userType?: string
  title?: string
  authorAssociation?: string
}

/**
 * Evaluates the step's `ELIGIBLE` expression against an event, by turning the
 * GitHub expression forms it uses into JavaScript.
 */
function eligible(event: Event): boolean {
  const js = stepBlock(STEP, "ELIGIBLE")
    .replace(/^\$\{\{|\}\}$/g, "")
    .replace(/contains\(([^,]+), ('[^']*')\)/g, "$1.includes($2)")
  const github = {
    event_name: event.event ?? "pull_request",
    repository: "owner/repo",
    event: {
      pull_request: {
        head: { repo: { full_name: event.headRepo ?? "owner/repo" } },
        user: { type: event.userType ?? "User" },
        title: event.title ?? "fix: something",
        author_association: event.authorAssociation ?? "CONTRIBUTOR",
      },
    },
  }
  return new Function("github", `return (${js})`)(github) as boolean
}

describe(`${WORKFLOW}: who gets a preview`, () => {
  it("previews same-repo PRs whatever the author's association says", () => {
    // An org member whose membership is private shows up as CONTRIBUTOR.
    for (const authorAssociation of ["CONTRIBUTOR", "MEMBER", "COLLABORATOR", "OWNER", "NONE"]) {
      expect(eligible({ authorAssociation }), authorAssociation).toBe(true)
    }
  })

  it("leaves out forks, bots, [skip ci] / [skip cd] titles and non-PR runs", () => {
    expect(eligible({ headRepo: "someone/fork" })).toBe(false)
    expect(eligible({ userType: "Bot" })).toBe(false)
    expect(eligible({ title: "chore: bump [skip ci]" })).toBe(false)
    expect(eligible({ title: "chore: bump [skip cd]" })).toBe(false)
    expect(eligible({ event: "push" })).toBe(false)
    expect(eligible({ event: "workflow_dispatch" })).toBe(false)
  })

  describe("the plan it writes", () => {
    let dir: string
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "preview-plan-"))
    })
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true })
    })

    function plan(env: { ELIGIBLE: string; IMAGE_APP?: string; STAGING_APP?: string }) {
      const output = join(dir, "output")
      writeFileSync(output, "")
      const result = spawnSync("bash", ["-e", "-c", stepBlock(STEP, "run")], {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_OUTPUT: output,
          IMAGE_APP: "image-app",
          STAGING_APP: "staging-app",
          PR: "42",
          SHA: "0123456789abcdef0123",
          OWNER: "Owner",
          ...env,
        },
      })
      expect(result.status, result.stderr).toBe(0)
      return readFileSync(output, "utf8").trim()
    }

    it("previews the image when the image app is set", () => {
      expect(plan({ ELIGIBLE: "true" })).toBe(
        [
          "preview=image",
          "image=ghcr.io/owner/pragmatic-papers-preview",
          "tag=pr-42-0123456789ab",
        ].join("\n"),
      )
    })

    it("falls back to Coolify's own previews without the image app", () => {
      expect(plan({ ELIGIBLE: "true", IMAGE_APP: "" })).toBe("preview=coolify")
      expect(plan({ ELIGIBLE: "true", IMAGE_APP: "", STAGING_APP: "" })).toBe("")
    })

    it("plans nothing for an ineligible PR", () => {
      expect(plan({ ELIGIBLE: "false" })).toBe("")
    })
  })
})
