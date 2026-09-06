/**
 * Where a feed's files come from. A feed adapter reads paths relative to an upstream root
 * and never cares whether that root is a GitHub repo at a ref, a checkout on disk (the
 * snapshot CLI, offline work) or a map of strings (tests).
 */
export interface FileSource {
  describe(): string
  read(path: string): Promise<string>
  readJson<T>(path: string): Promise<T>
}

function withJson(source: Omit<FileSource, "readJson">): FileSource {
  return {
    ...source,
    async readJson<T>(path: string): Promise<T> {
      const text = await source.read(path)
      try {
        return JSON.parse(text) as T
      } catch (err) {
        throw new Error(
          `${source.describe()} ${path}: not valid JSON (${err instanceof Error ? err.message : String(err)})`,
        )
      }
    },
  }
}

export interface GithubFileSourceOptions {
  /** "owner/name" */
  repo: string
  ref: string
  token?: string | null
  fetchImpl?: typeof fetch
}

/**
 * Reads a file through the contents API with the raw media type, which returns the bytes
 * directly (no base64, no 1 MB cap) and works on private repos with a fine-grained token
 * that has contents:read.
 */
export function githubFileSource({
  repo,
  ref,
  token,
  fetchImpl = (...args) => fetch(...args),
}: GithubFileSourceOptions): FileSource {
  const describe = (): string => `github:${repo}@${ref}`
  return withJson({
    describe,
    async read(path) {
      const url = `https://api.github.com/repos/${repo}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?ref=${encodeURIComponent(ref)}`
      const res = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github.raw+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) throw new Error(`${describe()} ${path}: HTTP ${res.status}`)
      return res.text()
    },
  })
}

/** An in-memory source for tests. */
export function memoryFileSource(files: Record<string, string | object>): FileSource {
  return withJson({
    describe: () => "memory",
    async read(path) {
      if (!(path in files)) throw new Error(`memory ${path}: not found`)
      const v = files[path]
      return typeof v === "string" ? v : JSON.stringify(v)
    },
  })
}

/**
 * A checkout on disk. Node-only, loaded lazily so this module stays importable wherever the
 * GitHub source is used.
 */
export function localFileSource(dir: string): FileSource {
  return withJson({
    describe: () => `dir:${dir}`,
    async read(path) {
      const [{ readFile }, { join }] = await Promise.all([
        import("node:fs/promises"),
        import("node:path"),
      ])
      return readFile(join(dir, path), "utf8")
    },
  })
}
