import { spawnSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const SCRIPT = resolve(__dirname, "../../dockerfiles/scripts/prune-registry.sh")
const CONTAINER = "registry-aow0w84kckskokscwgkg8k0o"
const REPO = "digitalgroundgame/pragmatic-papers"

// Fake docker and curl, each logging its arguments to $CALLS_LOG. docker answers the
// script's ps and inspect queries from $CONTAINERS, $RUNNING_IMAGES, $STORAGE and
// $REGISTRY_RUNNING, and `docker run` (the garbage collection) exits $GC_STATUS. curl
// prints $PAGES/page-<n>.json for the page asked for, or exits $CURL_STATUS.
const FAKES: Record<string, string> = {
  docker: `case "$1 $2" in
  "ps -a") printf '%s\\n' "$CONTAINERS" ;;
  "ps --format") printf '%s\\n' "$RUNNING_IMAGES" ;;
  "inspect -f") case "$3" in
    *var/lib/registry*) echo "$STORAGE" ;;
    *Config.Image*) echo registry:2 ;;
    *State.Running*) echo "\${REGISTRY_RUNNING:-true}" ;;
  esac ;;
  run*) echo "blobs eligible for deletion: 42"; exit "\${GC_STATUS:-0}" ;;
esac
exit 0`,
  curl: `[ -n "$CURL_STATUS" ] && exit "$CURL_STATUS"
for arg; do case "$arg" in *page=*) page=\${arg##*page=} ;; esac; done
cat "$PAGES/page-$page.json" 2>/dev/null || echo "[]"`,
}
const LOG_CALL = `echo "$(basename "$0") $*" >> "$CALLS_LOG"`

let dir: string
let storage: string
let tagsDir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "prune-registry-"))
  storage = join(dir, "registry")
  tagsDir = join(storage, "docker/registry/v2/repositories/pragmatic-papers/_manifests/tags")
  mkdirSync(tagsDir, { recursive: true })
  mkdirSync(join(dir, "bin"))
  mkdirSync(join(dir, "pages"))
  for (const [name, body] of Object.entries(FAKES)) {
    writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${LOG_CALL}\n${body}\n`)
    chmodSync(join(dir, "bin", name), 0o755)
  }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Creates the tags, oldest first, each a minute newer than the one before. */
function pushTags(...tags: string[]) {
  const start = Date.now() / 1000 - 86_400
  tags.forEach((tag, i) => {
    mkdirSync(join(tagsDir, tag, "current"), { recursive: true })
    utimesSync(join(tagsDir, tag), start + i * 60, start + i * 60)
  })
}

/** Makes GitHub list these PRs as open, 100 to a page. */
function openPrs(...numbers: number[]) {
  for (let page = 0; page * 100 < numbers.length; page++) {
    const pulls = numbers.slice(page * 100, page * 100 + 100).map((n) => ({
      url: `https://api.github.com/repos/${REPO}/pulls/${n}`,
      number: n,
      head: { repo: { url: `https://api.github.com/repos/${REPO}` } },
      milestone: { number: 1 },
    }))
    writeFileSync(join(dir, "pages", `page-${page + 1}.json`), JSON.stringify(pulls, null, 2))
  }
}

function run(args: string[] = [], env: Record<string, string> = {}) {
  const result = spawnSync("sh", [SCRIPT, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      CALLS_LOG: join(dir, "calls.log"),
      PAGES: join(dir, "pages"),
      CONTAINERS: `${CONTAINER}\ncoolify-proxy`,
      RUNNING_IMAGES: "",
      STORAGE: storage,
      REGISTRY_RUNNING: "true",
      CURL_STATUS: "",
      GC_STATUS: "",
      GITHUB_TOKEN: "",
      REGISTRY_CONTAINER: "",
      ...env,
    },
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

const remaining = () => readdirSync(tagsDir).sort()
const calls = () =>
  existsSync(join(dir, "calls.log")) ? readFileSync(join(dir, "calls.log"), "utf-8") : ""

describe("prune-registry.sh", () => {
  it("only reports what it would delete without --apply", () => {
    pushTags("pr-5-a", "pr-5-b", "pr-5-c", "pr-6-a")
    openPrs(5, 7)

    const { status, output } = run()

    expect(status).toBe(0)
    expect(output).toContain("pragmatic-papers: 4 tags, deleting 2, keeping:")
    expect(output).toContain("Dry run: would delete 2 of 4 tags")
    expect(remaining()).toEqual(["pr-5-a", "pr-5-b", "pr-5-c", "pr-6-a"])
    expect(calls()).not.toMatch(/docker (stop|run|start)/)
  })

  it("keeps each open PR's newest tags and deletes closed PRs' tags", () => {
    pushTags("pr-5-a", "pr-5-b", "pr-5-c", "pr-6-a", "pr-6-b", "pr-7-a")
    openPrs(5, 7)

    const { status } = run(["--apply"])

    expect(status).toBe(0)
    expect(remaining()).toEqual(["pr-5-b", "pr-5-c", "pr-7-a"])
  })

  it("keeps the newest KEEP_OTHER tags that aren't a PR's", () => {
    pushTags("aaa", "bbb", "ccc", "ddd", "pr-1-a")
    openPrs(1)

    run(["--apply"], { KEEP_OTHER: "2" })

    expect(remaining()).toEqual(["ccc", "ddd", "pr-1-a"])
  })

  it("keeps a tag a container is running, however old", () => {
    pushTags("pr-5-old", "pr-5-b", "pr-5-c", "pr-6-a")
    openPrs(5, 7)

    run(["--apply"], {
      RUNNING_IMAGES: "localhost:5000/pragmatic-papers:pr-5-old\nregistry:2",
    })

    expect(remaining()).toEqual(["pr-5-b", "pr-5-c", "pr-5-old"])
  })

  it("keeps a PR newer than every open one GitHub listed", () => {
    pushTags("pr-3-a", "pr-9-a")
    openPrs(5)

    run(["--apply"])

    expect(remaining()).toEqual(["pr-9-a"])
  })

  it("reads every page of open PRs", () => {
    pushTags("pr-150-a", "pr-151-a")
    openPrs(...Array.from({ length: 101 }, (_, i) => i + 50), 200)

    run(["--apply"])

    expect(remaining()).toEqual(["pr-150-a"])
    expect(calls()).toContain("page=2")
  })

  it("stops the registry, collects garbage and starts it again", () => {
    pushTags("pr-6-a", "pr-7-a")
    openPrs(7)

    const { status, output } = run(["--apply"])

    expect(status).toBe(0)
    const docker = calls()
      .split("\n")
      .filter((line) => /^docker (stop|run|start)/.test(line))
    expect(docker).toEqual([
      `docker stop ${CONTAINER}`,
      `docker run --rm --volumes-from ${CONTAINER} --entrypoint registry registry:2 garbage-collect --delete-untagged /etc/docker/registry/config.yml`,
      `docker start ${CONTAINER}`,
    ])
    expect(output).toContain("blobs eligible for deletion: 42")
  })

  it("leaves a stopped registry stopped", () => {
    pushTags("pr-6-a", "pr-7-a")
    openPrs(7)

    run(["--apply"], { REGISTRY_RUNNING: "false" })

    expect(calls()).not.toMatch(/docker (stop|start)/)
    expect(calls()).toContain("docker run")
  })

  it("starts the registry again and fails when garbage collection fails", () => {
    pushTags("pr-6-a", "pr-7-a")
    openPrs(7)

    const { status, output } = run(["--apply"], { GC_STATUS: "1" })

    expect(status).toBe(1)
    expect(output).toContain("ERROR: garbage collection failed")
    expect(calls()).toContain(`docker start ${CONTAINER}`)
  })

  it.each([
    ["GitHub can't be reached", { CURL_STATUS: "22" }],
    ["GitHub lists no open PRs", {}],
  ])("deletes nothing when %s", (_, env) => {
    pushTags("pr-6-a", "pr-7-a")

    const { status, output } = run(["--apply"], env)

    expect(status).toBe(1)
    expect(output).toContain("couldn't list digitalgroundgame/pragmatic-papers's open PRs")
    expect(remaining()).toEqual(["pr-6-a", "pr-7-a"])
    expect(calls()).not.toMatch(/docker (stop|run)/)
  })

  it("deletes nothing when a later page of open PRs fails", () => {
    pushTags("pr-150-a")
    openPrs(...Array.from({ length: 100 }, (_, i) => i + 50))
    writeFileSync(
      join(dir, "bin", "curl"),
      `#!/bin/sh
for arg; do case "$arg" in *page=2) exit 22 ;; esac; done
cat "$PAGES/page-1.json"
`,
    )

    const { status } = run(["--apply"])

    expect(status).toBe(1)
    expect(remaining()).toEqual(["pr-150-a"])
  })

  it("refuses to guess between registry containers", () => {
    openPrs(1)

    const { status, output } = run([], { CONTAINERS: "registry-one\nregistry-two" })

    expect(status).toBe(1)
    expect(output).toContain("expected one registry-* container")
  })

  it("rejects an unknown argument", () => {
    expect(run(["--aply"]).status).toBe(2)
  })
})
