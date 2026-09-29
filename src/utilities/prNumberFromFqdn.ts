/**
 * The PR number of a Coolify preview, from its COOLIFY_FQDN: `986` for
 * `pr-986.pragmaticpapers.com`. Reads the first label, as `modify-database-uri.sh` does for
 * the per-PR database. `""` when the host isn't a PR preview, so no tag is set rather than a
 * wrong one.
 */
export function prNumberFromFqdn(fqdn: string | undefined): string {
  return fqdn?.split(".")[0]?.match(/^pr-(\d+)$/)?.[1] ?? ""
}
