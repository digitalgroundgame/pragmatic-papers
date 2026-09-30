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
const MAIN_HEAD = "a1f79b203e16a25c805b4580bdabe56a21164c31"

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
for arg; do case "$arg" in
  *commits\?sha=*) branch=\${arg##*sha=}; branch=\${branch%%&*}
    [ -n "$COMMITS_STATUS" ] && exit "$COMMITS_STATUS"
    cat "$PAGES/commits-$branch.json" 2>/dev/null || echo "[]"; exit 0 ;;
  *page=*) page=\${arg##*page=} ;;
esac; done
cat "$PAGES/page-$page.json" 2>/dev/null || echo "[]"`,
}
const LOG_CALL = `echo "$(basename "$0") $*" >> "$CALLS_LOG"`

let dir: string
let storage: string
let tagsDir: string
/** Each manifest putManifest stored, by digest. */
const names = new Map<string, string>()

/** Makes GitHub list these as the branch's newest commits, newest first. */
function branchCommits(branch: string, ...shas: string[]) {
  const commits = shas.map((sha, i) => ({
    sha,
    commit: { tree: { sha: "f".repeat(40) } },
    parents: [{ sha: shas[i + 1] ?? "e".repeat(40) }],
  }))
  writeFileSync(join(dir, "pages", `commits-${branch}.json`), JSON.stringify(commits, null, 2))
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "prune-registry-"))
  storage = join(dir, "registry")
  tagsDir = join(storage, "docker/registry/v2/repositories/pragmatic-papers/_manifests/tags")
  mkdirSync(tagsDir, { recursive: true })
  mkdirSync(join(dir, "bin"))
  mkdirSync(join(dir, "pages"))
  branchCommits("main", MAIN_HEAD)
  for (const [name, body] of Object.entries(FAKES)) {
    writeFileSync(join(dir, "bin", name), `#!/bin/sh\n${LOG_CALL}\n${body}\n`)
    chmodSync(join(dir, "bin", name), 0o755)
  }
})

afterEach(() => {
  names.clear()
  rmSync(dir, { recursive: true, force: true })
})

const digestOf = (name: string) => createHash("sha256").update(name).digest("hex")

/** Stores a manifest blob and registers it in the repository, the way a push does. */
function putManifest(name: string, manifest: object) {
  const hex = digestOf(name)
  names.set(hex, name)
  const blob = join(storage, "docker/registry/v2/blobs/sha256", hex.slice(0, 2), hex)
  mkdirSync(blob, { recursive: true })
  writeFileSync(join(blob, "data"), JSON.stringify(manifest, null, 2))
  const revision = join(tagsDir, "../revisions/sha256", hex)
  mkdirSync(revision, { recursive: true })
  writeFileSync(join(revision, "link"), `sha256:${hex}`)
  return hex
}

/**
 * Pushes the tags, oldest first, each a minute after the one before. A tag in `indexes` is
 * an image index, as Coolify pushes them, listing `<tag>-amd64`, `<tag>-attestation` and
 * any `shared` platform images; any other is a plain image.
 */
function pushTagsAs(indexes: string[], tags: string[], shared: string[] = []) {
  const start = Date.now() / 1000 - 86_400
  tags.forEach((tag, i) => {
    const image = { schemaVersion: 2, config: { digest: "sha256:c0" }, layers: [] }
    let hex: string
    if (indexes.includes(tag)) {
      const children = [`${tag}-amd64`, `${tag}-attestation`, ...shared].map((child) => ({
        mediaType: "application/vnd.oci.image.manifest.v1+json",
        digest: `sha256:${putManifest(child, image)}`,
      }))
      hex = putManifest(tag, { schemaVersion: 2, manifests: children })
    } else {
      hex = putManifest(tag, image)
    }

    const current = join(tagsDir, tag, "current")
    mkdirSync(current, { recursive: true })
    mkdirSync(join(tagsDir, tag, "index/sha256", hex), { recursive: true })
    writeFileSync(join(current, "link"), `sha256:${hex}`)
    utimesSync(join(current, "link"), start + i * 60, start + i * 60)
  })
}

/** Pushes plain images. */
function pushTags(...tags: string[]) {
  pushTagsAs([], tags)
}

/** The manifests still registered in the repository, by name. */
const registered = () =>
  readdirSync(join(tagsDir, "../revisions/sha256"))
    .map((hex) => names.get(hex))
    .sort()

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
      COMMITS_STATUS: "",
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

  it("keeps a tag named after one of main's newest commits, however old", () => {
    pushTags(MAIN_HEAD, "bbb", "ccc", "pr-1-a")
    openPrs(1)

    const { output } = run(["--apply"], { KEEP_OTHER: "1" })

    expect(output).toContain("Keeping main's newest 5 commits' tags")
    expect(remaining()).toEqual([MAIN_HEAD, "ccc", "pr-1-a"])
  })

  it("asks GitHub for KEEP_PER_BRANCH commits of each branch in KEEP_BRANCHES", () => {
    pushTags("1".repeat(40), "2".repeat(40), "pr-1-a")
    branchCommits("release", "1".repeat(40))
    openPrs(1)

    run(["--apply"], { KEEP_OTHER: "0", KEEP_BRANCHES: "main release", KEEP_PER_BRANCH: "3" })

    expect(remaining()).toEqual(["1".repeat(40), "pr-1-a"])
    expect(calls()).toContain("commits?sha=main&per_page=3")
    expect(calls()).toContain("commits?sha=release&per_page=3")
  })

  it.each([
    ["GitHub can't list them", { COMMITS_STATUS: "22" }],
    ["the branch has none", { KEEP_BRANCHES: "gone" }],
  ])("deletes nothing when a kept branch's commits are unknown because %s", (_, env) => {
    pushTags("pr-6-a", "pr-7-a")
    openPrs(7)

    const { status, output } = run(["--apply"], env)

    expect(status).toBe(1)
    expect(output).toMatch(/couldn't list \w+'s commits; deleting nothing/)
    expect(remaining()).toEqual(["pr-6-a", "pr-7-a"])
    expect(calls()).not.toMatch(/docker (stop|run)/)
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

  it("unregisters a deleted index with the manifests it lists, and keeps a kept one's", () => {
    pushTagsAs(["pr-6-a", "pr-7-a"], ["pr-6-a", "pr-7-a"])
    openPrs(7)

    const { status, output } = run(["--apply"])

    expect(status).toBe(0)
    expect(remaining()).toEqual(["pr-7-a"])
    expect(registered()).toEqual(["pr-7-a", "pr-7-a-amd64", "pr-7-a-attestation"])
    expect(output).toContain("Deleted 1 tags and unregistered 3 manifests")
  })

  it("keeps a platform image a kept index shares with a deleted one", () => {
    pushTagsAs(["pr-6-a", "pr-7-a"], ["pr-6-a", "pr-7-a"], ["unchanged-layer-image"])
    openPrs(7)

    run(["--apply"])

    expect(registered()).toEqual([
      "pr-7-a",
      "pr-7-a-amd64",
      "pr-7-a-attestation",
      "unchanged-layer-image",
    ])
  })

  it("unregisters every image a deleted tag has named, not only its latest", () => {
    pushTags("pr-6-a", "pr-7-a")
    // pr-6-a was pushed before, as another image.
    const earlier = putManifest("pr-6-a-earlier", { schemaVersion: 2, layers: [] })
    mkdirSync(join(tagsDir, "pr-6-a/index/sha256", earlier), { recursive: true })
    openPrs(7)

    run(["--apply"])

    expect(registered()).toEqual(["pr-7-a"])
  })

  it("leaves images no tag it deletes has named", () => {
    pushTags("pr-6-a", "pr-7-a")
    putManifest("pushed-by-digest", { schemaVersion: 2, layers: [] })
    openPrs(7)

    run(["--apply"])

    expect(registered()).toEqual(["pr-7-a", "pushed-by-digest"])
  })

  it("counts the manifests it would unregister in a dry run, and unregisters none", () => {
    pushTagsAs(["pr-6-a", "pr-7-a"], ["pr-6-a", "pr-7-a"])
    openPrs(7)

    const { output } = run()

    expect(output).toContain("would delete 1 of 2 tags and unregister their 3 manifests")
    expect(registered()).toHaveLength(6)
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
          `^docker run --rm --volumes-from ${CONTAINER} --env-file \\S+ --entrypoint registry registry:2 garbage-collect /etc/docker/registry/config.yml$`,
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
