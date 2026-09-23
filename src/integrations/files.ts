/**
 * Where a set of files comes from.
 *
 * A reader asks for paths relative to some root and never cares whether that root is a
 * repository at a ref, an archive downloaded from a release, a checkout on disk (the snapshot
 * CLI, offline work) or a map of strings (tests). It is the seam that lets one integration
 * hand its files to a feature that knows nothing about it.
 */
export interface FileSource {
  describe(): string
  read(path: string): Promise<string>
  readJson<T>(path: string): Promise<T>
}

/** Adds `readJson` to a source that can only read text, naming the file when it is not JSON. */
export function withJson(source: Omit<FileSource, "readJson">): FileSource {
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
