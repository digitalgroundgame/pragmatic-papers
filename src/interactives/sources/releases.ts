/**
 * Finding the newest tagged data release in an upstream repo.
 *
 * A feed that publishes releases gives a consumer something a branch cannot: an immutable ref.
 * Reading a branch can catch a push mid-flight, or catch two directories disagreeing across
 * two commits. Reading a tag cannot, because the tag stops moving the moment it exists.
 *
 * We ask the releases API rather than polling a version file on the default branch, which is
 * both cheaper (one request, and the version is in the tag name) and free of a real race: the
 * version file lands on the branch first and the release is cut afterwards, so a consumer that
 * reads the version and then asks for its tag can ask for one that does not exist yet.
 */

/**
 * The value a `ref` takes when the caller has no opinion: let the adapter resolve whatever
 * upstream last released. Anything else is honoured verbatim, so a branch or a specific tag
 * can still be pinned.
 */
export const RELEASE_REF = "release"

export interface ReleaseRef {
  /** The git tag, e.g. `data-v05d95d9fcf1b`. */
  tag: string
  /** What follows the prefix — upstream's own version stamp. */
  version: string
}

export interface LatestReleaseOptions {
  /** "owner/name" */
  repo: string
  /** Only releases whose tag starts with this are considered. */
  tagPrefix: string
  token?: string | null
  fetchImpl?: typeof fetch
}

interface GithubRelease {
  tag_name?: unknown
  draft?: unknown
}

/**
 * The newest release whose tag carries `tagPrefix`, or null when the repo has published none
 * yet. A failed request throws rather than returning null: "the API refused us" and "there are
 * no releases" must not look the same, or a token with the wrong scope would silently
 * downgrade the caller to reading a branch.
 */
export async function latestTaggedRelease({
  repo,
  tagPrefix,
  token,
  fetchImpl = (...args) => fetch(...args),
}: LatestReleaseOptions): Promise<ReleaseRef | null> {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=30`
  const res = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`github:${repo} releases: HTTP ${res.status}`)

  const body: unknown = await res.json()
  if (!Array.isArray(body)) throw new Error(`github:${repo} releases: unexpected response`)

  // GitHub returns releases newest first; a draft is not published data.
  for (const item of body as GithubRelease[]) {
    if (item.draft === true) continue
    const tag = item.tag_name
    if (typeof tag !== "string" || !tag.startsWith(tagPrefix)) continue
    const version = tag.slice(tagPrefix.length)
    if (version === "") continue
    return { tag, version }
  }
  return null
}
