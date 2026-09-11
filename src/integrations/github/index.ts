import { env, type Integration } from "../types"
import type { FileSource } from "../files"
import { githubFileSource } from "./contents"
import {
  latestTaggedRelease,
  releaseTarballSource,
  type ReleaseAsset,
  type ReleaseRef,
} from "./releases"

/**
 * A connection to one GitHub repository we read data out of.
 *
 * Not "GitHub": *this repository, with this credential*. A second repo read with a second
 * token is a second connection, declared beside the first in `../index`, and each answers
 * separately whether it is configured — which is what an admin status view needs to show and
 * what a sync needs to decide whether to run.
 *
 * What it offers is the three ways a repository hands over files, in order of preference:
 *
 *   `filesFromRelease`  one download of an archive attached to a release — fewest requests,
 *                       and no way to see two files from two builds
 *   `filesAt`           the contents API at a ref, file by file
 *   (a caller's own)    a checkout on disk or a memory source, for the CLI and tests
 *
 * plus `latestRelease`, which is how a caller finds an immutable ref to pin to in the first
 * place. Everything takes an optional `fetchImpl` so a test never touches the network.
 */
export interface GithubRepoIntegration extends Integration {
  /** "owner/name", from the environment override or the declared default. */
  repo(): string
  /** The credential, or null when none is set — a public repository needs none. */
  token(): string | null
  /** Files at a branch, tag or commit, read one at a time through the contents API. */
  filesAt(ref: string, opts?: { fetchImpl?: typeof fetch }): FileSource
  /** The newest published release whose tag carries `tagPrefix`, or null when there is none. */
  latestRelease(opts: { tagPrefix: string; fetchImpl?: typeof fetch }): Promise<ReleaseRef | null>
  /**
   * Files out of a `.tar.gz` attached to a release, or null when that release has no such
   * asset — which is every release cut before the publisher started attaching one, so a
   * caller is expected to fall back to `filesAt(release.tag)`.
   */
  filesFromRelease(
    release: ReleaseRef,
    assetName: string,
    opts?: { fetchImpl?: typeof fetch },
  ): Promise<FileSource | null>
}

export interface GithubRepoOptions {
  id: string
  label: string
  /** The repository read when the override is unset: "owner/name". */
  defaultRepo: string
  /** Environment variable that overrides the repository — for a fork, or a staging mirror. */
  repoEnv: string
  /** Environment variable holding a fine-grained token with `contents: read`. */
  tokenEnv: string
  /**
   * Whether the token is required. A private repository cannot be read without one, and a
   * sync against it should skip with a clear message rather than fail every request; a public
   * one only wants the token for a higher rate limit.
   */
  tokenRequired?: boolean
}

export function githubRepo({
  id,
  label,
  defaultRepo,
  repoEnv,
  tokenEnv,
  tokenRequired = true,
}: GithubRepoOptions): GithubRepoIntegration {
  const repo = (): string => env(repoEnv) ?? defaultRepo
  const token = (): string | null => env(tokenEnv)
  return {
    id,
    label,
    service: "GitHub",
    describe: () => `github:${repo()}`,
    required: tokenRequired ? [tokenEnv] : [],
    optional: tokenRequired ? [repoEnv] : [tokenEnv, repoEnv],
    repo,
    token,
    filesAt(ref, opts) {
      return githubFileSource({ repo: repo(), ref, token: token(), fetchImpl: opts?.fetchImpl })
    },
    latestRelease({ tagPrefix, fetchImpl }) {
      return latestTaggedRelease({ repo: repo(), tagPrefix, token: token(), fetchImpl })
    },
    async filesFromRelease(release, assetName, opts) {
      const asset: ReleaseAsset | undefined = release.assets.find((a) => a.name === assetName)
      if (!asset) return null
      return releaseTarballSource({
        label: `github:${repo()}@${release.tag} ${asset.name}`,
        url: asset.url,
        token: token(),
        fetchImpl: opts?.fetchImpl,
      })
    },
  }
}

export type { ReleaseAsset, ReleaseRef } from "./releases"
export { RELEASE_REF } from "./releases"
