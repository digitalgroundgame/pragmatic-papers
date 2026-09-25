import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}))

import { execSync, spawnSync } from "node:child_process"
import {
  CONTAINER_SCRIPT,
  isDockerAvailable,
  main,
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

describe("CONTAINER_SCRIPT", () => {
  it("wipes node_modules for a new lockfile before installing, and stamps it only after", () => {
    const steps = CONTAINER_SCRIPT.split(" && ")
    const wipe = steps.findIndex((s) => s.includes("find node_modules -mindepth 1 -delete"))
    const install = steps.indexOf("pnpm install --frozen-lockfile")
    const stamp = steps.findIndex((s) => s.includes("> node_modules/.e2e-lockfile"))
    expect(wipe).toBeGreaterThan(-1)
    expect(wipe).toBeLessThan(install)
    expect(stamp).toBeGreaterThan(install)
    expect(steps.at(-1)).toBe('node scripts/test-e2e.mjs "$@"')
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

describe("main", () => {
  const originalArgv = process.argv

  afterEach(() => {
    vi.mocked(execSync).mockReset()
    vi.mocked(spawnSync).mockReset()
    process.argv = originalArgv
    vi.restoreAllMocks()
  })

  it("logs an error and exits without running compose when Docker is unreachable", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("connect ENOENT /var/run/docker.sock")
    })
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)

    main()

    expect(error).toHaveBeenCalledWith("Docker daemon not reachable — start Docker and try again.")
    expect(exit).toHaveBeenCalledWith(1)
    expect(spawnSync).not.toHaveBeenCalled()
  })

  it("runs compose with the parsed args and always tears down, even on failure", () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(""))
    vi.mocked(spawnSync).mockImplementation((_cmd, args) => {
      if (args?.includes("down")) return { status: 0 } as ReturnType<typeof spawnSync>
      throw new Error("compose run blew up")
    })
    process.argv = ["node", "test-e2e-docker.ts", "--update-snapshots=missing"]

    expect(() => main()).toThrow("compose run blew up")

    const [runCall, downCall] = vi.mocked(spawnSync).mock.calls
    expect(runCall?.[1]).toEqual(expect.arrayContaining(["run", "--rm", "playwright"]))
    expect(runCall?.[1]).toEqual(expect.arrayContaining([CONTAINER_SCRIPT]))
    expect(runCall?.[1]).toEqual(expect.arrayContaining(["--update-snapshots=missing"]))
    expect(downCall?.[1]).toEqual(expect.arrayContaining(["down", "--remove-orphans"]))
  })

  it("sets exitCode from the compose run's status", () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(""))
    vi.mocked(spawnSync).mockReturnValue({ status: 3 } as ReturnType<typeof spawnSync>)
    process.argv = ["node", "test-e2e-docker.ts"]

    main()

    expect(process.exitCode).toBe(3)
    process.exitCode = undefined
  })
})
