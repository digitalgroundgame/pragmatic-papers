import { withJson, type FileSource } from "../files"

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
