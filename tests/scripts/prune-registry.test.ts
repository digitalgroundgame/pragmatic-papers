import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
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
// script's ps and inspect queries from $CONTAINERS, $RUNNING_IMAGES, $REGISTRY_ENV (the
// container's environment), $REGISTRY_RUNNING and $STORAGE (the source of the mount at
// $STORAGE_ROOT). `docker run` (the garbage collection) logs the env file it was given and
// exits $GC_STATUS. curl
// prints $PAGES/page-<n>.json for the page asked for, or exits $CURL_STATUS.
const FAKES: Record<string, string> = {
  docker: `case "$1 $2" in
  "ps -a") printf '%s\\n' "$CONTAINERS" ;;
  "ps --format") printf '%s\\n' "$RUNNING_IMAGES" ;;
  "inspect -f") case "$3" in
    *Config.Env*) printf '%s\\n' "$REGISTRY_ENV" ;;
    *'"'"$STORAGE_ROOT"'"'*) echo "$STORAGE" ;;
    *Config.Image*) echo registry:2 ;;
    *State.Running*) echo "\${REGISTRY_RUNNING:-true}" ;;
  esac ;;
  run*) for arg; do [ "$prev" = --env-file ] && sed 's/^/env: /' "$arg" >> "$CALLS_LOG"; prev=$arg; done
    echo "blobs eligible for deletion: 42"; exit "\${GC_STATUS:-0}" ;;
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

/**
 * Pushes the tags, oldest first, each a minute after the one before: its current/link names
 * a manifest blob, an image's or, for a tag listed in `indexes`, an image index's.
 */
function pushTagsAs(indexes: string[], ...tags: string[]) {
  const start = Date.now() / 1000 - 86_400
  tags.forEach((tag, i) => {
    const hex = createHash("sha256").update(tag).digest("hex")
    const blob = join(storage, "docker/registry/v2/blobs/sha256", hex.slice(0, 2), hex)
    mkdirSync(blob, { recursive: true })
    const manifest = indexes.includes(tag)
      ? { schemaVersion: 2, manifests: [{ digest: "sha256:0" }] }
      : { schemaVersion: 2, config: {}, layers: [] }
    writeFileSync(join(blob, "data"), JSON.stringify(manifest))

    const current = join(tagsDir, tag, "current")
    mkdirSync(current, { recursive: true })
    writeFileSync(join(current, "link"), `sha256:${hex}`)
    utimesSync(join(current, "link"), start + i * 60, start + i * 60)
  })
}

/** Pushes plain images. */
function pushTags(...tags: string[]) {
  pushTagsAs([], ...tags)
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
      // Coolify's template: the storage is at /data, not the image's /var/lib/registry.
      REGISTRY_ENV: "REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY=/data\nREGISTRY_HTTP_SECRET=s3cret",
      STORAGE_ROOT: "/data",
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

  it("ranks a tag by its latest push, not its first", () => {
    pushTags("aaa", "bbb", "ccc")
    // Pushing aaa again rewrites its link, not its directory.
    utimesSync(join(tagsDir, "aaa", "current", "link"), new Date(), new Date())
    openPrs(1)

    run(["--apply"], { KEEP_OTHER: "2" })

    expect(remaining()).toEqual(["aaa", "ccc"])
  })

  it("refuses to run while a tag it keeps is an image index", () => {
    pushTagsAs(["pr-7-b"], "pr-6-a", "pr-7-a", "pr-7-b")
    openPrs(7)

    const { status, output } = run(["--apply"])

    expect(status).toBe(1)
    expect(output).toContain("these tags are image indexes")
    expect(output).toContain("  pr-7-b")
    expect(remaining()).toEqual(["pr-6-a", "pr-7-a", "pr-7-b"])
    expect(calls()).not.toMatch(/docker (stop|run)/)
  })

  it("deletes an image index it doesn't keep", () => {
    pushTagsAs(["pr-6-a"], "pr-6-a", "pr-7-a")
    openPrs(7)

    const { status } = run(["--apply"])

    expect(status).toBe(0)
    expect(remaining()).toEqual(["pr-7-a"])
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
      expect.stringMatching(
        new RegExp(
          `^docker run --rm --volumes-from ${CONTAINER} --env-file \\S+ --entrypoint registry registry:2 garbage-collect --delete-untagged /etc/docker/registry/config.yml$`,
        ),
      ),
      `docker start ${CONTAINER}`,
    ])
    expect(output).toContain("blobs eligible for deletion: 42")
  })

  it("collects garbage with the registry's environment, where its storage is", () => {
    pushTags("pr-6-a", "pr-7-a")
    openPrs(7)

    const { output } = run(["--apply"])

    expect(output).toContain(`Storage: /data in the container, ${storage} on this server`)
    expect(calls()).toContain("env: REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY=/data\n")
    expect(calls()).toContain("env: REGISTRY_HTTP_SECRET=s3cret\n")
  })

  it("looks for the storage at /var/lib/registry when the environment doesn't move it", () => {
    pushTags("pr-6-a", "pr-7-a")
    openPrs(7)

    const { status } = run(["--apply"], { REGISTRY_ENV: "", STORAGE_ROOT: "/var/lib/registry" })

    expect(status).toBe(0)
    expect(remaining()).toEqual(["pr-7-a"])
  })

  it("deletes nothing when the storage isn't where the environment says", () => {
    pushTags("pr-6-a", "pr-7-a")
    openPrs(7)

    // The storage is mounted at /data, but nothing tells the script so.
    const { status, output } = run(["--apply"], { REGISTRY_ENV: "" })

    expect(status).toBe(1)
    expect(output).toContain(
      "can't find registry-aow0w84kckskokscwgkg8k0o's storage, /var/lib/registry",
    )
    expect(remaining()).toEqual(["pr-6-a", "pr-7-a"])
    expect(calls()).not.toMatch(/docker (stop|run)/)
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
