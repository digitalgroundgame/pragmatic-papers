import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "../..")

const read = (file: string) => readFileSync(join(ROOT, ".github/workflows", file), "utf8")

/** The folded `<key>: >-` block that starts on the line matching `start`. */
function folded(file: string, start: RegExp): string {
  const all = read(file).split("\n")
  const at = all.findIndex((line) => start.test(line))
  expect(at, `no ${start} in ${file}`).toBeGreaterThan(-1)
  const indent = all[at + 1]!.search(/\S/)
  const body: string[] = []
  for (const line of all.slice(at + 1)) {
    if (line.trim() !== "" && line.search(/\S/) < indent) break
    body.push(line.trim())
  }
  return body.join(" ")
}

/**
 * Evaluates a GitHub expression against a `github` context, by turning the
 * handful of forms these workflows use into JavaScript. A missing property is
 * null in an expression, not an error, hence the optional chaining.
 */
function evaluate(expression: string, github: unknown): unknown {
  const js = expression
    .replace(/\$\{\{|\}\}/g, "")
    .replace(/github((?:\.[a-z_]+)+)/g, (_, path: string) => `github${path.replace(/\./g, "?.")}`)
  const contains = (haystack: string | unknown[] | undefined | null, needle: unknown) =>
    haystack != null && haystack.includes(needle as never)
  return new Function("github", "contains", `return (${js})`)(github, contains)
}

describe("claude-review.yml", () => {
  const condition = folded("claude-review.yml", /^ {4}if: >-$/)

  const pr = (event: {
    action: string
    label?: string
    draft?: boolean
    base?: string
    fork?: boolean
  }) => ({
    repository: "owner/repo",
    event: {
      action: event.action,
      label: event.label === undefined ? undefined : { name: event.label },
      pull_request: {
        number: 7,
        draft: event.draft ?? false,
        base: { ref: event.base ?? "dev" },
        head: { repo: { full_name: event.fork ? "someone/repo" : "owner/repo" } },
      },
    },
  })

  const reviews = (event: Parameters<typeof pr>[0]) => Boolean(evaluate(condition, pr(event)))

  it("listens for ready_for_review and labeled pull_request events only", () => {
    expect(read("claude-review.yml")).toMatch(
      /\non:\n {2}pull_request:\n {4}types: \[ready_for_review, labeled\]\n\n/,
    )
  })

  it("reviews a PR into dev when it goes from draft to ready", () => {
    expect(reviews({ action: "ready_for_review" })).toBe(true)
  })

  it("reviews when the in review label is added to a ready PR", () => {
    expect(reviews({ action: "labeled", label: "in review" })).toBe(true)
  })

  it("skips other labels, drafts, forks and PRs into other branches", () => {
    expect(reviews({ action: "labeled", label: "e2e" })).toBe(false)
    expect(reviews({ action: "labeled", label: "in review", draft: true })).toBe(false)
    expect(reviews({ action: "ready_for_review", fork: true })).toBe(false)
    expect(reviews({ action: "ready_for_review", base: "main" })).toBe(false)
  })

  it("never lets another label's run cancel a review in progress", () => {
    const group = folded("claude-review.yml", /^ {2}group: >-$/)
    const key = (event: Parameters<typeof pr>[0]) =>
      group.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression: string) =>
        String(evaluate(expression, { ...pr(event), run_id: "123" })),
      )
    expect(key({ action: "ready_for_review" })).toBe(key({ action: "labeled", label: "in review" }))
    expect(key({ action: "labeled", label: "e2e" })).not.toBe(key({ action: "ready_for_review" }))
  })

  it("reviews the PR's head, not the merge commit, and shows the action's progress comment", () => {
    const workflow = read("claude-review.yml")
    expect(workflow).toContain("HEAD_SHA: ${{ github.event.pull_request.head.sha }}")
    expect(workflow).toContain("at ${{ env.HEAD_SHA }}")
    expect(workflow).toContain("track_progress: true")
    expect(workflow).not.toContain("${{ github.sha }}")
  })
})

describe("the review in the action's progress comment", () => {
  /** The jq regex review-ack.yml picks a review summary with, unescaped. */
  const summary = () => {
    const quoted = read("review-ack.yml").match(/test\("(.+?)"\)\)/)?.[1]
    expect(quoted, "no summary regex in review-ack.yml").toBeDefined()
    return new RegExp(quoted!.replace(/\\\\/g, "\\"))
  }
  const sha = "a".repeat(40)
  // The shape of the action's final progress comment (comment-logic.ts): its
  // header, a rule, then the body Claude wrote.
  const progressComment = (marker: string) =>
    [
      "**Claude finished @tadjh's task in 2m 10s** —— [View job](https://example.com)",
      "",
      "---",
      "## Code Review",
      "",
      "🟢 **Pass:** no blockers.",
      "",
      marker,
    ].join("\n")

  it("asks for the summary as the progress comment's final body, with the visible marker", () => {
    const workflow = read("claude-review.yml")
    expect(workflow).toContain("following .claude/skills/code-review/SKILL.md")
    expect(workflow).toContain("the summary is the final body of your progress comment")
    expect(workflow).toContain(
      "<sub>claude-review sha=${{ env.HEAD_SHA }} verdict=<pass|blocker></sub>",
    )
    expect(workflow).toContain("track_progress: true")
    expect(workflow).toContain("--json-schema")
  })

  it("is found by review-ack.yml under the action's header", () => {
    expect(progressComment(`<sub>claude-review sha=${sha} verdict=pass</sub>`)).toMatch(summary())
  })

  it("still finds a local review's hidden marker, with or without the Claude Code footer", () => {
    const local = `## Code Review\n\n<!-- claude-review sha=${sha} verdict=pass -->`
    expect(local).toMatch(summary())
    expect(`${local}\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_`).toMatch(
      summary(),
    )
  })

  it("doesn't count a comment that only quotes a marker", () => {
    const quoted = `${progressComment(`<sub>claude-review sha=${sha} verdict=pass</sub>`)}\n\nMore text`
    expect(quoted).not.toMatch(summary())
  })

  it("checks the verdict the way review-ack reads the marker", () => {
    const workflow = read("claude-review.yml")
    expect(workflow).toContain('grep -o "<sub>claude-review sha=$HEAD_SHA verdict=[a-z]*</sub>"')
    expect(workflow).toContain("fromJSON(steps.review.outputs.structured_output).verdict")
  })
})

describe("claude-review.yml's verdict check", () => {
  /** The `run:` script of the "Check the verdict" step. */
  const script = () => {
    const all = read("claude-review.yml").split("\n")
    const start = all.findIndex((line) => line.trim() === "- name: Check the verdict")
    const run = all.findIndex((line, i) => i > start && line.trim() === "run: |")
    const indent = all[run + 1]!.search(/\S/)
    const body: string[] = []
    for (const line of all.slice(run + 1)) {
      if (line.trim() !== "" && line.search(/\S/) < indent) break
      body.push(line.slice(indent))
    }
    return body.join("\n")
  }

  const sha = "b".repeat(40)

  /** Runs the step with `gh` answering with `comments`, Claude's comment bodies. */
  function check(comments: string[], verdict: string) {
    const dir = mkdtempSync(join(tmpdir(), "claude-verdict-"))
    try {
      const gh = join(dir, "gh")
      writeFileSync(join(dir, "bodies"), comments.join("\n"))
      writeFileSync(gh, `#!/bin/sh\ncat "${dir}/bodies"\n`)
      chmodSync(gh, 0o755)
      return spawnSync("bash", ["-e", "-c", script()], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          REPO: "owner/repo",
          PR_NUMBER: "7",
          HEAD_SHA: sha,
          VERDICT: verdict,
        },
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  const marker = (verdict: string, of = sha) =>
    `<sub>claude-review sha=${of} verdict=${verdict}</sub>`

  it("passes when the structured verdict is pass and the comment carries this commit's marker", () => {
    expect(check([marker("pass")], "pass").status).toBe(0)
  })

  it("fails on a blocker", () => {
    expect(check([marker("blocker")], "blocker").status).toBe(1)
  })

  it("fails when the comment has no marker for this commit, whatever the verdict", () => {
    const result = check([marker("pass", "c".repeat(40))], "pass")
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("/reviewed can't count it")
  })

  it("falls back to the marker's verdict without structured output", () => {
    expect(check([marker("blocker")], "").status).toBe(1)
    expect(check([marker("pass")], "").status).toBe(0)
  })
})

describe("claude.yml", () => {
  const condition = folded("claude.yml", /^ {4}if: >-$/)

  const comment = (body: string) => ({
    event_name: "issue_comment",
    event: { comment: { body } },
  })

  it("answers a comment that mentions @claude", () => {
    expect(evaluate(condition, comment("@claude review this please"))).toBe(true)
  })

  it("ignores comments without a mention, and comments an agent posted", () => {
    expect(evaluate(condition, comment("looks good"))).toBe(false)
    expect(
      evaluate(
        condition,
        comment(
          "@claude can you check?\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_",
        ),
      ),
    ).toBe(false)
  })

  it("answers mentions in review comments and reviews", () => {
    expect(
      evaluate(condition, {
        event_name: "pull_request_review_comment",
        event: { comment: { body: "@claude why?" } },
      }),
    ).toBe(true)
    expect(
      evaluate(condition, {
        event_name: "pull_request_review",
        event: { review: { body: "@claude review" } },
      }),
    ).toBe(true)
    expect(
      evaluate(condition, { event_name: "pull_request_review", event: { review: { body: null } } }),
    ).toBe(false)
  })

  it("runs the same /code-review when asked for a review, so /reviewed counts it", () => {
    expect(read("claude.yml")).toContain(
      "follow .claude/skills/code-review/SKILL.md for it in its progress-comment mode",
    )
  })
})

describe("claude-security-review.yml", () => {
  const workflow = () => read("claude-security-review.yml")

  it("runs exactly when the Claude review does", () => {
    const on = (file: string) => read(file).match(/\non:\n[\s\S]*?\n\n/)?.[0]
    expect(on("claude-security-review.yml")).toBeDefined()
    expect(on("claude-security-review.yml")).toBe(on("claude-review.yml"))
    expect(folded("claude-security-review.yml", /^ {4}if: >-$/)).toBe(
      folded("claude-review.yml", /^ {4}if: >-$/),
    )
  })

  it("never lets another label's run cancel a review in progress, or share a group with the code review", () => {
    const group = (file: string, event: { action: string; label?: string }) =>
      folded(file, /^ {2}group: >-$/).replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression: string) =>
        String(
          evaluate(expression, {
            run_id: "123",
            event: {
              action: event.action,
              label: event.label === undefined ? undefined : { name: event.label },
              pull_request: { number: 7 },
            },
          }),
        ),
      )
    const file = "claude-security-review.yml"
    expect(group(file, { action: "ready_for_review" })).toBe(
      group(file, { action: "labeled", label: "in review" }),
    )
    expect(group(file, { action: "labeled", label: "e2e" })).not.toBe(
      group(file, { action: "ready_for_review" }),
    )
    expect(group(file, { action: "ready_for_review" })).not.toBe(
      group("claude-review.yml", { action: "ready_for_review" }),
    )
  })

  it("reviews the PR's head on the subscription token, following the security-review skill", () => {
    expect(workflow()).toContain("uses: anthropics/claude-code-action@v1")
    expect(workflow()).toContain("claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}")
    expect(workflow()).not.toContain("ANTHROPIC_API_KEY")
    expect(workflow()).toContain("HEAD_SHA: ${{ github.event.pull_request.head.sha }}")
    expect(workflow()).toContain("at ${{ env.HEAD_SHA }}")
    expect(workflow()).not.toContain("${{ github.sha }}")
    expect(workflow()).toContain(".claude/skills/security-review/SKILL.md")
    expect(existsSync(join(ROOT, ".claude/skills/security-review/SKILL.md"))).toBe(true)
  })

  it("leaves the model to the action's default", () => {
    expect(workflow()).not.toMatch(/--model\b/)
  })
})
