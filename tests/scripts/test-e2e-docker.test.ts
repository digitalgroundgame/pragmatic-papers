import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}))

import { execSync } from "node:child_process"
import {
  isDockerAvailable,
  missingFontTokenWarning,
  resolveArgs,
} from "../../scripts/test-e2e-docker"

describe("resolveArgs", () => {
  it("falls back to the default changed-snapshots invocation when no args are passed", () => {
    expect(resolveArgs([])).toEqual(["--update-snapshots=changed", "--project=chromium"])
  })

  it("passes user-supplied args through unchanged", () => {
    expect(resolveArgs(["--update-snapshots=missing"])).toEqual(["--update-snapshots=missing"])
  })
})

describe("missingFontTokenWarning", () => {
  it("returns null when GH_FONT_READ is set", () => {
    expect(missingFontTokenWarning({ GH_FONT_READ: "token" })).toBeNull()
  })

  it("returns a warning when GH_FONT_READ is unset", () => {
    expect(missingFontTokenWarning({})).toContain("GH_FONT_READ is not set")
  })

  it("returns a warning when GH_FONT_READ is empty", () => {
    expect(missingFontTokenWarning({ GH_FONT_READ: "" })).toContain("GH_FONT_READ is not set")
  })
})

describe("isDockerAvailable", () => {
  afterEach(() => {
    vi.mocked(execSync).mockReset()
  })

  it("returns true when `docker info` succeeds", () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(""))
    expect(isDockerAvailable()).toBe(true)
  })

  it("returns false when `docker info` throws", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("connect ENOENT /var/run/docker.sock")
    })
    expect(isDockerAvailable()).toBe(false)
  })
})
