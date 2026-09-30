import type { PayloadRequest } from "payload"

/**
 * Who may call Payload's `POST /api/payload-jobs/run`: any logged-in user, or a
 * caller sending `Authorization: Bearer <CRON_SECRET>`.
 *
 * The jobs themselves run in-process on `jobs.autoRun`, so nothing in this repo
 * calls the endpoint with the secret; it's there for a scheduler outside the app
 * (it was Vercel Cron's before the move to Coolify). Without `CRON_SECRET` the
 * Bearer route is closed: comparing against `Bearer ${undefined}` would let anyone
 * sending `Authorization: Bearer undefined` in.
 */
export function canRunJobs({ req }: { req: PayloadRequest }): boolean {
  if (req.user) return true

  const secret = process.env.CRON_SECRET
  if (!secret) return false

  return req.headers.get("authorization") === `Bearer ${secret}`
}
