import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { CONTAINER_SCRIPT, FONT_REGISTRY_AUTH } from "../../scripts/test-e2e-docker"

const root = path.resolve(__dirname, "../..")
const read = (file: string): string => readFileSync(path.join(root, file), "utf8")

// The user-level line that authenticates GitHub Packages: a placeholder pnpm expands from
// GH_FONT_READ at install time, never the token itself (#955).
const AUTH_LINE = '//npm.pkg.github.com/:_authToken=${GH_FONT_READ:-""}'

describe("project .npmrc", () => {
  // pnpm ignores ${VAR} in a committed project .npmrc's credentials, since a change to the
  // file could point them at another registry. Credentials belong in a user-level .npmrc.
  it("holds no registry credentials", () => {
    const settings = read(".npmrc")
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
    for (const line of settings) {
      expect(line).not.toMatch(/_authToken|_auth\b|_password|username|\$\{/)
    }
    expect(settings).toContain("@digitalgroundgame:registry=https://npm.pkg.github.com")
  })
})

describe("user-level GitHub Packages auth", () => {
  let home: string | undefined
  afterEach(() => {
    if (home) rmSync(home, { recursive: true, force: true })
    home = undefined
  })

  it("is written by both Dockerfiles before they fetch dependencies", () => {
    for (const file of [
      "dockerfiles/PragmaticPapers.Dockerfile",
      "dockerfiles/PragmaticPapers.ci.Dockerfile",
    ]) {
      const dockerfile = read(file)
      const write = dockerfile.indexOf(`printf '%s\\n' '${AUTH_LINE}' > "$HOME/.npmrc"`)
      expect(write, file).toBeGreaterThan(-1)
      expect(write, file).toBeLessThan(dockerfile.indexOf("pnpm fetch"))
    }
  })

  it("is written by the E2E container before it installs", () => {
    expect(FONT_REGISTRY_AUTH).toBe(AUTH_LINE)
    const steps = CONTAINER_SCRIPT.split(" && ")
    const write = steps.findIndex((step) => step.endsWith('> "$HOME/.npmrc"'))
    expect(write).toBeGreaterThan(-1)
    expect(write).toBeLessThan(steps.indexOf("pnpm install --frozen-lockfile"))
  })

  // The shell writes the placeholder literally, so the token never lands in a file or a
  // Docker layer, even when GH_FONT_READ is set.
  it("writes the placeholder, not the token", () => {
    home = mkdtempSync(path.join(tmpdir(), "npmrc-"))
    const steps = CONTAINER_SCRIPT.split(" && ")
    const write = steps.find((step) => step.endsWith('> "$HOME/.npmrc"'))
    execFileSync("sh", ["-c", write!], {
      env: { ...process.env, HOME: home, GH_FONT_READ: "not-a-real-token" },
    })
    expect(readFileSync(path.join(home, ".npmrc"), "utf8")).toBe(`${AUTH_LINE}\n`)
  })

  // setup-node's registry-url writes a user-level .npmrc that reads NODE_AUTH_TOKEN, so the
  // install step has to have it.
  it("reaches CI's install step", () => {
    const action = read(".github/actions/setup-project/action.yml")
    const install = action.slice(action.indexOf("run: pnpm install --frozen-lockfile"))
    const env = install.slice(0, install.indexOf("- name:"))
    expect(env).toContain("NODE_AUTH_TOKEN: ${{ inputs.gh-font-read-token }}")
    expect(action).toContain('registry-url: "https://npm.pkg.github.com"')
  })
})
