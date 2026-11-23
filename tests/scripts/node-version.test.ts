import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "../..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

const DOCKERFILES = [
  "dockerfiles/PragmaticPapers.Dockerfile",
  "dockerfiles/PragmaticPapers.ci.Dockerfile",
]

type Version = [number, number, number]

const parse = (version: string): Version => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  expect(match, `"${version}" isn't a full x.y.z version`).not.toBeNull()
  return [Number(match![1]), Number(match![2]), Number(match![3])]
}

const atLeast = (a: Version, b: Version) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! > b[i]!
  return true
}

const dockerNode = (file: string) => {
  const match = read(file).match(/^ARG NODE_VERSION=(.+)$/m)
  expect(match, `no ARG NODE_VERSION in ${file}`).not.toBeNull()
  return match![1]!.trim()
}

const engineMinimum = () => {
  const range = JSON.parse(read("package.json")).engines.node as string
  const match = range.match(/^>=(\d+\.\d+\.\d+)$/)
  expect(match, `package.json engines.node "${range}" isn't ">=x.y.z"`).not.toBeNull()
  return match![1]!
}

/**
 * The lowest version of `major` each locked package accepts, from the `engines` ranges
 * in pnpm-lock.yaml written as `^major.minor.patch` (Payload's `^24.22.3`, for one).
 */
const lockedMinimums = (major: number) => {
  const minimums: { range: string; min: string }[] = []
  for (const [, quoted, bare] of read("pnpm-lock.yaml").matchAll(
    /engines: \{node: (?:'([^']+)'|([^,}]+))/g,
  )) {
    const range = (quoted ?? bare)!.trim()
    for (const part of range.split("||")) {
      const match = part.trim().match(/^\^(\d+)\.(\d+)\.(\d+)$/)
      if (match && Number(match[1]) === major) {
        minimums.push({ range, min: `${match[1]}.${match[2]}.${match[3]}` })
      }
    }
  }
  return minimums
}

describe("the Node version", () => {
  it("is the same in both Dockerfiles", () => {
    const versions = DOCKERFILES.map(dockerNode)
    expect(new Set(versions).size, versions.join(" vs ")).toBe(1)
  })

  it("in the Dockerfiles meets package.json's engines.node", () => {
    const version = parse(dockerNode(DOCKERFILES[0]!))
    expect(atLeast(version, parse(engineMinimum()))).toBe(true)
  })

  it("in package.json's engines.node is one every locked dependency accepts", () => {
    const minimum = parse(engineMinimum())
    const tooLow = lockedMinimums(minimum[0])
      .filter(({ min }) => !atLeast(minimum, parse(min)))
      .map(({ range }) => range)
    expect([...new Set(tooLow)]).toEqual([])
  })

  it("finds Payload's range in the lockfile, so the check above has something to check", () => {
    expect(lockedMinimums(24).length).toBeGreaterThan(0)
  })
})
