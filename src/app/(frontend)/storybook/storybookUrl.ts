// The Cloudflare Worker CI's "Deploy Storybook" job publishes to
// (.storybook/wrangler.jsonc): `dev` deploys to its main address, and each PR
// uploads a version under a `pr-<number>` preview alias.
const WORKER = "pragmatic-papers-storybook"
const SUBDOMAIN = "digital-ground-game.workers.dev"

const PR_PREVIEW_HOST = /^pr-(\d+)\./

/**
 * Where `/storybook` on a deployment points: a PR preview
 * (`pr-<n>.pragmaticpapers.com`) to that PR's Storybook, anything else to the
 * one `dev` last deployed.
 */
export function storybookUrl(host: string | null | undefined): string {
  const pr = host?.match(PR_PREVIEW_HOST)?.[1]
  return pr ? `https://pr-${pr}-${WORKER}.${SUBDOMAIN}` : `https://${WORKER}.${SUBDOMAIN}`
}
