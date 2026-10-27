import path from "node:path"

/**
 * Whether two module ids name the same file. Vite's ids use forward slashes and can carry a
 * `?query`, while `path.resolve` gives Windows backslashes, so the ids are compared as paths
 * rather than as strings.
 */
export function sameFile(a: string, b: string, paths: path.PlatformPath = path): boolean {
  const fileOf = (id: string) => paths.resolve(id.split("?")[0]!)
  return paths.relative(fileOf(a), fileOf(b)) === ""
}
