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

import { isRecord } from "@/utilities/isRecord"

import { gunzip, readTar, tarFileSource } from "../archive"
import type { FileSource } from "../files"

/**
 * The value a `ref` takes when the caller has no opinion: let the adapter resolve whatever
 * upstream last released. Anything else is honoured verbatim, so a branch or a specific tag
 * can still be pinned.
 */
export const RELEASE_REF = "release"

export interface ReleaseAsset {
  name: string
  /** The API URL. `browser_download_url` is unauthenticated storage, so a private repo 404s. */
  url: string
}

export interface ReleaseRef {
  /** The git tag, e.g. `data-v05d95d9fcf1b`. */
  tag: string
  /** What follows the prefix — upstream's own version stamp. */
  version: string
  /** What is attached to the release, so a consumer can prefer an archive over a file walk. */
  assets: ReleaseAsset[]
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
  assets?: unknown
}

function assetsOf(release: GithubRelease): ReleaseAsset[] {
  if (!Array.isArray(release.assets)) return []
  const out: ReleaseAsset[] = []
  for (const item of release.assets) {
    if (!isRecord(item)) continue
    const { name, url } = item
    if (typeof name === "string" && typeof url === "string") out.push({ name, url })
  }
  return out
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
    return { tag, version, assets: assetsOf(item) }
  }
  return null
}

export interface ReleaseAssetSourceOptions {
  /** What to call this source in an error: the release it came from. */
  label: string
  /** The asset's API URL, which is what serves the bytes on a private repo. */
  url: string
  token?: string | null
  fetchImpl?: typeof fetch
}

/**
 * Downloads a `.tar.gz` release asset and serves its files.
 *
 * The asset is fetched through the API URL with `application/octet-stream`, not through
 * `browser_download_url`: the latter is a redirect to unauthenticated storage, which a private
 * repo answers with a 404.
 */
export async function releaseTarballSource({
  label,
  url,
  token,
  fetchImpl = (...args) => fetch(...args),
}: ReleaseAssetSourceOptions): Promise<FileSource> {
  const res = await fetchImpl(url, {
    headers: {
      Accept: "application/octet-stream",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`)
  const entries = readTar(await gunzip(new Uint8Array(await res.arrayBuffer())))
  if (entries.size === 0) throw new Error(`${label}: archive carries no files`)
  return tarFileSource(label, entries)
}
