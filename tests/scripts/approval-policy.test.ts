import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it, vi } from "vitest"
import { parse } from "yaml"

import {
  decide,
  type FileChange,
  globToRegExp,
  main,
  matchesPaths,
  parsePolicy,
  parseRawDiff,
  type Policy,
  type Review,
  reviewPassed,
} from "../../scripts/approval-policy"
import { SENSITIVE } from "../../scripts/review-effort"

const repoPolicy = parsePolicy(
  parse(readFileSync(resolve(__dirname, "../../.claude/approvals.yml"), "utf8")),
)

const file = (path: string, mode = "100644"): FileChange => ({ path, modes: [mode, mode] })
const clean: Review = { verdict: "pass", findings: { blocker: 0, should_fix: 0, worth_noting: 2 } }
const shouldFix: Review = {
  verdict: "pass",
  findings: { blocker: 0, should_fix: 1, worth_noting: 0 },
}

describe("globToRegExp", () => {
  it.each([
    ["**/*.md", "README.md", true],
    ["**/*.md", ".claude/skills/code-review/SKILL.md", true],
    ["**/*.md", "src/docs/writing.mdx", false],
    ["src/docs/**", "src/docs/writing/articles/footnotes.md", true],
    ["*.md", "src/README.md", false],
    ["**/__tests__/**", "src/a/__tests__/b.test.ts", true],
    ["src/?.ts", "src/a.ts", true],
    ["src/?.ts", "src/ab.ts", false],
    ["next.config.ts", "nextXconfig.ts", false],
  ])("%s against %s is %s", (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected)
  })
})

describe("matchesPaths", () => {
  it("leaves out paths a ! pattern excludes", () => {
    expect(matchesPaths("docs/a.md", ["**/*.md", "!docs/**"])).toBe(false)
    expect(matchesPaths("src/a.md", ["**/*.md", "!docs/**"])).toBe(true)
  })
})

describe("parsePolicy", () => {
  it("defaults mode to enforce, claude to comments and seats to 0", () => {
    expect(parsePolicy({ version: 1, rules: [{ purpose: "p", paths: ["**"] }] })).toEqual({
      version: 1,
      mode: "enforce",
      rules: [
        { purpose: "p", paths: ["**"], verdict: { claude: "comments", seats: 0 }, override: [] },
      ],
    })
  })

  it.each([
    ["an unknown top-level key", { version: 1, rules: [], nested: "inherit" }],
    ["another version", { version: 2, rules: [] }],
    ["an unknown rule key", { version: 1, rules: [{ purpose: "p", paths: ["**"], if: "x" }] }],
    ["a rule without paths", { version: 1, rules: [{ purpose: "p", paths: [] }] }],
    [
      "a bad verdict",
      { version: 1, rules: [{ purpose: "p", paths: ["**"], verdict: { claude: "yes" } }] },
    ],
    [
      "too many seats",
      { version: 1, rules: [{ purpose: "p", paths: ["**"], verdict: { seats: 17 } }] },
    ],
    [
      "a condition this subset doesn't read",
      {
        version: 1,
        rules: [
          {
            purpose: "p",
            paths: ["**"],
            override: [{ if: "repo/change_risk <= medium", verdict: {} }],
          },
        ],
      },
    ],
  ])("refuses %s", (_, policy) => {
    expect(() => parsePolicy(policy)).toThrow()
  })
})

describe("reviewPassed", () => {
  it("needs a pass with no blocker and no should-fix", () => {
    expect(reviewPassed(clean)).toBe(true)
    expect(reviewPassed(shouldFix)).toBe(false)
    expect(reviewPassed({ verdict: "blocker", findings: { blocker: 1, should_fix: 0 } })).toBe(
      false,
    )
  })

  it("doesn't count a review without finding counts as a pass", () => {
    expect(reviewPassed({ verdict: "pass" })).toBe(false)
  })
})

describe("parseRawDiff", () => {
  it("reads each path and its modes", () => {
    const raw = [
      ":100644 100644 aaa bbb M\tsrc/a.ts",
      ":000000 120000 000 ccc A\tlink",
      ":160000 160000 ddd eee M\tvendor/sub",
      "",
    ].join("\n")
    expect(parseRawDiff(raw)).toEqual([
      { path: "src/a.ts", modes: ["100644", "100644"] },
      { path: "link", modes: ["000000", "120000"] },
      { path: "vendor/sub", modes: ["160000", "160000"] },
    ])
  })
})

describe("decide with the repo's policy", () => {
  it.each([
    [
      "a help doc and its picture",
      ["src/docs/writing/articles/footnotes.md", "src/docs/writing/articles/footnotes-hero.webp"],
    ],
    ["a unit test", ["src/utilities/__tests__/truncate.test.ts"]],
    ["a story", ["src/components/Card/Card.stories.tsx"]],
    ["an integration test", ["tests/integration/comments.test.ts"]],
    ["the README", ["README.md"]],
  ])("approves %s after a clean review", (_, paths) => {
    expect(
      decide(
        repoPolicy,
        paths.map((p) => file(p)),
        clean,
        "User",
      ).approve,
    ).toBe(true)
  })

  it("doesn't approve after a review with a should-fix finding", () => {
    expect(decide(repoPolicy, [file("README.md")], shouldFix, "User")).toEqual({
      approve: false,
      reason: expect.stringContaining("README.md"),
    })
  })

  it("doesn't approve code", () => {
    expect(
      decide(repoPolicy, [file("README.md"), file("src/utilities/truncate.ts")], clean, "User"),
    ).toEqual({
      approve: false,
      reason: "no rule covers src/utilities/truncate.ts",
    })
  })

  it.each([
    ".github/pull_request_template.md",
    ".claude/skills/code-review/SKILL.md",
    "AGENTS.md",
    "CLAUDE.md",
    "tests/scripts/review-effort.test.ts",
    "src/access/__tests__/roles.test.ts",
    "src/plugins/sso/__tests__/links.test.ts",
    "src/plugins/comments/README.md",
    "src/migrations/README.md",
    "dockerfiles/README.md",
    "cloudflare/README.md",
    "src/cloudflare/README.md",
  ])("never approves %s", (path) => {
    expect(decide(repoPolicy, [file(path)], clean, "User").approve).toBe(false)
  })

  it.each([".claude/approvals.yml", "REVIEW.md", ".github/CODEOWNERS", "docs/.gitattributes"])(
    "never approves a change to %s, which is protected",
    (path) => {
      const everything: Policy = {
        version: 1,
        mode: "enforce",
        rules: [{ purpose: "all", paths: ["**"], verdict: { claude: "approves", seats: 0 } }],
      }
      expect(decide(everything, [file(path)], clean, "User")).toEqual({
        approve: false,
        reason: `${path} is protected`,
      })
    },
  )

  it("never approves a symlink or submodule", () => {
    expect(decide(repoPolicy, [file("docs/link.md", "120000")], clean, "User").approve).toBe(false)
  })

  it("never approves a PR a bot opened", () => {
    expect(decide(repoPolicy, [file("README.md")], clean, "Bot")).toEqual({
      approve: false,
      reason: "a bot opened this PR",
    })
  })

  // A path SENSITIVE (review-effort.ts) gives more scrutiny must never be
  // approved without a person. Each pattern needs a sample here, so a new one
  // fails this test until it has one, and the policy covers it.
  const sensitiveSamples = [
    ".github/workflows/README.md",
    "src/migrations/__tests__/x.test.ts",
    "src/access/__tests__/x.test.ts",
    "src/plugins/sso/__tests__/x.test.ts",
    "src/plugins/comments/__tests__/x.test.ts",
    "src/hooks/purgeEdgeCache.ts",
    "src/cloudflare/__tests__/x.test.ts",
    "cloudflare/README.md",
    "dockerfiles/README.md",
    "src/payload.config.ts",
    "next.config.ts",
  ]

  it.each(SENSITIVE.map((pattern) => [String(pattern)]))(
    "has a sample for SENSITIVE %s",
    (source) => {
      const pattern = SENSITIVE.find((p) => String(p) === source)!
      expect(sensitiveSamples.some((path) => pattern.test(path))).toBe(true)
    },
  )

  it.each(sensitiveSamples)("needs a person for %s", (path) => {
    expect(decide(repoPolicy, [file(path)], clean, "User").approve).toBe(false)
  })
})

describe("main", () => {
  const files: Record<string, string> = {
    "policy.json": JSON.stringify(
      parse(readFileSync(resolve(__dirname, "../../.claude/approvals.yml"), "utf8")),
    ),
    "diff.txt": ":100644 100644 aaa bbb M\tREADME.md\n",
    "review.json": JSON.stringify(clean),
  }
  const run = (overrides: Record<string, string> = {}, authorType = "User") => {
    const outputs: Record<string, string> = {}
    const log = vi.fn()
    const code = main(["policy.json", "diff.txt", "review.json", authorType], {
      read: (path) => ({ ...files, ...overrides })[path] ?? "",
      output: (name, value) => {
        outputs[name] = value
      },
      log,
    })
    return { code, outputs, log }
  }

  it("approves a clean docs change", () => {
    expect(run().outputs).toEqual({
      approve: "true",
      reason: "every changed file is one the policy lets Claude approve",
    })
  })

  it("reports but doesn't approve in observe mode", () => {
    const observe = JSON.stringify({ ...JSON.parse(files["policy.json"]!), mode: "observe" })
    const { outputs, log } = run({ "policy.json": observe })
    expect(outputs.approve).toBe("false")
    expect(log).toHaveBeenCalledWith(expect.stringContaining("observe mode"))
  })

  it("approves nothing when the policy is invalid", () => {
    const { code, outputs } = run({ "policy.json": '{"version": 2, "rules": []}' })
    expect(code).toBe(0)
    expect(outputs.approve).toBe("false")
    expect(outputs.reason).toMatch(/can't be applied/)
  })

  it("approves nothing without a review", () => {
    expect(run({ "review.json": "" }).outputs.approve).toBe("false")
  })

  it("asks for its arguments", () => {
    const log = vi.fn()
    expect(main([], { read: () => "", output: vi.fn(), log })).toBe(1)
  })
})
