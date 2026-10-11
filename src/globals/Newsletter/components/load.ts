import { integrationStatus, listmonkServer } from "@/integrations"
import {
  getNewsletterListStats,
  listmonkAdminUrl,
  ListmonkError,
  listRecentCampaigns,
  listRecentSignups,
  type NewsletterCampaign,
  type NewsletterListStats,
  type NewsletterSignup,
} from "@/integrations/listmonk"

/**
 * One part of the page. Each is read on its own, so a role that can read the list but not its
 * subscribers still shows the counts.
 */
export type Section<T> = { ok: true; data: T } | { ok: false; reason: "forbidden" | "error" }

export type NewsletterOverview =
  | { connected: false }
  | {
      connected: true
      adminUrl: string
      list: Section<NewsletterListStats>
      signups: Section<NewsletterSignup[]>
      campaigns: Section<NewsletterCampaign[]>
    }

export const RECENT_SIGNUPS = 8
export const RECENT_CAMPAIGNS = 5
/** The page waits for Listmonk no longer than this. */
const TIMEOUT_MS = 5000

function toSection<T>(result: PromiseSettledResult<T>, what: string): Section<T> {
  if (result.status === "fulfilled") return { ok: true, data: result.value }
  console.error(`[newsletter] System → Newsletter couldn't read ${what}`, result.reason)
  const forbidden = result.reason instanceof ListmonkError && result.reason.status === 403
  return { ok: false, reason: forbidden ? "forbidden" : "error" }
}

/** Reads the newsletter's list, newest signups and campaigns from Listmonk, all at once. */
export async function loadNewsletterOverview(): Promise<NewsletterOverview> {
  // What's missing is listed on the Integrations global, not here.
  if (!integrationStatus(listmonkServer).configured) return { connected: false }

  const init = { signal: AbortSignal.timeout(TIMEOUT_MS) }
  const [list, signups, campaigns] = await Promise.allSettled([
    getNewsletterListStats(init),
    listRecentSignups(RECENT_SIGNUPS, init),
    listRecentCampaigns(RECENT_CAMPAIGNS, init),
  ])
  return {
    connected: true,
    adminUrl: listmonkAdminUrl(),
    list: toSection(list, "the newsletter list"),
    signups: toSection(signups, "recent signups"),
    campaigns: toSection(campaigns, "campaigns"),
  }
}
