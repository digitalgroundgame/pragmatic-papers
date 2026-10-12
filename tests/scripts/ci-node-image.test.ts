import { spawnSync } from "node:child_process"
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "../..")
const DOCKERFILE = "dockerfiles/PragmaticPapers.ci.Dockerfile"
const ACTION = ".github/actions/build-app-image/action.yml"
const WORKFLOW = ".github/workflows/ci-images.yml"

const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

/** The `run: |` script of the step named `name` in a workflow or action file. */
function stepScript(file: string, name: string): string {
  const lines = read(file).split("\n")
  const start = lines.findIndex((line) => line.trim() === `- name: ${name}`)
  expect(start, `no step named "${name}" in ${file}`).toBeGreaterThan(-1)
  const run = lines.findIndex((line, i) => i > start && line.trim() === "run: |")
  const indent = lines[run + 1]!.search(/\S/)
  const body: string[] = []
  for (const line of lines.slice(run + 1)) {
    if (line.trim() !== "" && line.search(/\S/) < indent) break
    body.push(line.slice(indent))
  }
  return body.join("\n")
}

describe("the CI Dockerfile's Node base image", () => {
  it("builds every stage on the NODE_REGISTRY build arg, ECR Public by default", () => {
    const dockerfile = read(DOCKERFILE)
    expect(dockerfile).toMatch(/^ARG NODE_REGISTRY=public\.ecr\.aws\/docker\/library$/m)
    const nodeStages = dockerfile.match(/^FROM .*node:.*$/gm)
    expect(nodeStages).toHaveLength(2)
    for (const line of nodeStages!) {
      expect(line).toMatch(/^FROM \$\{NODE_REGISTRY\}\/node:\$\{NODE_VERSION\}-alpine AS \w+$/)
    }
  })

  it("is passed to the build by build-app-image", () => {
    expect(read(ACTION)).toContain("NODE_REGISTRY=${{ steps.node-registry.outputs.value }}")
  })

  it("is copied into GHCR by ci-images.yml, rebuilt when the Dockerfile changes", () => {
    const workflow = read(WORKFLOW)
    expect(workflow).toMatch(/image: \[postgres, node\]/)
    expect(workflow).toContain(`- ${DOCKERFILE}`)
  })
})

describe("build-app-image's Choose the Node base image step", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ci-node-image-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  // Runs the step from the repo root, with a fake `docker` that records its arguments
  // and exits with `inspectStatus`.
  function choose({ loggedIn = true, inspectStatus = 0 } = {}) {
    const docker = join(dir, "docker")
    writeFileSync(docker, `#!/bin/sh\necho "$*" >> "${dir}/calls"\nexit ${inspectStatus}\n`)
    chmodSync(docker, 0o755)
    const output = join(dir, "output")
    writeFileSync(output, "")
    const result = spawnSync(
      "bash",
      ["-e", "-c", stepScript(ACTION, "Choose the Node base image")],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          GITHUB_OUTPUT: output,
          LOGGED_IN: String(loggedIn),
          MIRROR: "ghcr.io/digitalgroundgame",
        },
      },
    )
    let calls = ""
    try {
      calls = readFileSync(join(dir, "calls"), "utf8")
    } catch {
      // docker was never called
    }
    return {
      status: result.status,
      stdout: result.stdout,
      output: readFileSync(output, "utf8"),
      calls,
    }
  }

  const version = () => read(DOCKERFILE).match(/^ARG NODE_VERSION=(.+)$/m)![1]

  it("uses the GHCR copy when it has this NODE_VERSION", () => {
    const { status, output, calls } = choose()
    expect(status).toBe(0)
    expect(output).toBe("value=ghcr.io/digitalgroundgame\n")
    expect(calls).toBe(
      `buildx imagetools inspect ghcr.io/digitalgroundgame/node:${version()}-alpine\n`,
    )
  })

  it("falls back to ECR Public, with a warning, when the copy is missing", () => {
    const { status, output, stdout } = choose({ inspectStatus: 1 })
    expect(status).toBe(0)
    expect(output).toBe("value=public.ecr.aws/docker/library\n")
    expect(stdout).toContain(`::warning::No GHCR copy of node:${version()}-alpine`)
  })

  it("falls back to ECR Public without asking GHCR when the login failed", () => {
    const { status, output, calls } = choose({ loggedIn: false })
    expect(status).toBe(0)
    expect(output).toBe("value=public.ecr.aws/docker/library\n")
    expect(calls).toBe("")
  })
})

describe("ci-images.yml's Choose the tag step", () => {
  function tag(image: string) {
    const dir = mkdtempSync(join(tmpdir(), "ci-images-tag-"))
    try {
      const output = join(dir, "output")
      writeFileSync(output, "")
      const result = spawnSync("bash", ["-e", "-c", stepScript(WORKFLOW, "Choose the tag")], {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, GITHUB_OUTPUT: output, IMAGE: image },
      })
      expect(result.status).toBe(0)
      return readFileSync(output, "utf8")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it("tags Node with the Dockerfile's NODE_VERSION, which build-app-image looks for", () => {
    expect(tag("node")).toMatch(/^value=\d+\.\d+\.\d+-alpine\n$/)
  })

  it("keeps Postgres on 17-alpine", () => {
    expect(tag("postgres")).toBe("value=17-alpine\n")
  })
})
