/**
 * The commit this deployment runs: Coolify gives the container `SOURCE_COMMIT` at runtime
 * (null where nothing sets it, like `pnpm dev` and the Worker).
 *
 * `.github/workflows/deployments.yml` polls it on staging and production after each push,
 * to mark the push's GitHub Deployment live once the site answers with that commit. Public,
 * like the Sentry release in every page's scripts, and never cached, so the edge can't
 * answer with the previous release's commit.
 */
export const dynamic = "force-dynamic"

export function GET(): Response {
  return Response.json(
    { commit: process.env.SOURCE_COMMIT || null },
    { headers: { "Cache-Control": "no-store" } },
  )
}
