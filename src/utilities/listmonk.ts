/**
 * Listmonk REST client.
 *
 * Listmonk is the self-hosted mailing list manager that owns subscribers,
 * unsubscribes, suppression, and the daily campaign queue for the newsletter.
 * This module is the only place the rest of the codebase talks to Listmonk.
 *
 * Required env vars:
 *   LISTMONK_BASE_URL                   e.g. https://listmonk.example.com
 *   LISTMONK_API_USER                   admin/API user
 *   LISTMONK_API_TOKEN                  admin/API token
 *   LISTMONK_NEWSLETTER_LIST_ID         numeric ID of the "Newsletter" list
 *   NEWSLETTER_FROM_EMAIL               e.g. "Pragmatic Papers <newsletter@newsletter.example.com>"
 *   LISTMONK_WELCOME_TX_TEMPLATE_ID     numeric ID of a Listmonk transactional
 *                                       template whose body is `{{ .Tx.Data.body }}`
 *                                       (passthrough for our pre-rendered HTML)
 */

const REQUIRED_ENV = [
  "LISTMONK_BASE_URL",
  "LISTMONK_API_USER",
  "LISTMONK_API_TOKEN",
  "LISTMONK_NEWSLETTER_LIST_ID",
  "NEWSLETTER_FROM_EMAIL",
] as const

interface ListmonkConfig {
  baseUrl: string
  apiUser: string
  apiToken: string
  newsletterListId: number
  fromEmail: string
  welcomeTxTemplateId?: number
}

function readConfig(): ListmonkConfig {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
  }
  return {
    baseUrl: process.env.LISTMONK_BASE_URL!.replace(/\/$/, ""),
    apiUser: process.env.LISTMONK_API_USER!,
    apiToken: process.env.LISTMONK_API_TOKEN!,
    newsletterListId: Number(process.env.LISTMONK_NEWSLETTER_LIST_ID),
    fromEmail: process.env.NEWSLETTER_FROM_EMAIL!,
    welcomeTxTemplateId: process.env.LISTMONK_WELCOME_TX_TEMPLATE_ID
      ? Number(process.env.LISTMONK_WELCOME_TX_TEMPLATE_ID)
      : undefined,
  }
}

async function listmonkFetch<T>(
  path: string,
  init: RequestInit & { searchParams?: Record<string, string> } = {},
): Promise<T> {
  const cfg = readConfig()
  const url = new URL(`${cfg.baseUrl}/api${path}`)
  if (init.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) url.searchParams.set(k, v)
  }
  const auth = `token ${cfg.apiUser}:${cfg.apiToken}`
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Listmonk ${init.method ?? "GET"} ${path} → ${res.status}: ${body}`)
  }
  const json = (await res.json()) as { data: T }
  return json.data
}

export interface CreateCampaignInput {
  name: string
  subject: string
  bodyHtml: string
  /** ISO 8601; Listmonk schedules at this wall-clock instant. */
  sendAt: string
}

interface ListmonkCampaign {
  id: number
  name: string
  status: string
  send_at: string | null
}

export interface ScheduledCampaignSummary {
  id: number
  name: string
  sendAt: Date
}

/**
 * Create a campaign in `scheduled` status, targeting the configured newsletter
 * list, with the given pre-rendered HTML body. Returns the new campaign id.
 *
 * Listmonk requires two calls — POST creates as `draft`, then PUT status
 * transitions to `scheduled`. We do both here so callers don't have to.
 */
export async function createScheduledCampaign(input: CreateCampaignInput): Promise<number> {
  const cfg = readConfig()
  const created = await listmonkFetch<ListmonkCampaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      subject: input.subject,
      lists: [cfg.newsletterListId],
      from_email: cfg.fromEmail,
      content_type: "html",
      body: input.bodyHtml,
      send_at: input.sendAt,
      type: "regular",
      messenger: "email",
    }),
  })
  await listmonkFetch<ListmonkCampaign>(`/campaigns/${created.id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status: "scheduled" }),
  })
  return created.id
}

/**
 * Returns all `scheduled` or `running` campaigns on the newsletter list with a
 * non-null send_at. Used by the job for two things:
 *   - latest send_at across the result = baseline for the queue-overlap policy
 *   - existing campaign names = idempotency check (skip days already scheduled
 *     so retries don't create duplicates)
 */
export async function listScheduledCampaigns(): Promise<ScheduledCampaignSummary[]> {
  const cfg = readConfig()
  const data = await listmonkFetch<{ results: ListmonkCampaign[] }>("/campaigns", {
    searchParams: {
      status: "scheduled,running",
      list_id: String(cfg.newsletterListId),
      per_page: "200",
    },
  })
  return data.results
    .filter((c) => c.send_at !== null)
    .map((c) => ({ id: c.id, name: c.name, sendAt: new Date(c.send_at!) }))
}

export interface SubscribeMemberInput {
  email: string
  /** Optional display name; Listmonk stores it but it's not required. */
  name?: string
}

/**
 * Subscribe an email to the newsletter list. Listmonk applies the list's
 * double-opt-in configuration: status becomes `enabled` (confirmed) only after
 * the recipient clicks the confirmation link.
 */
export async function subscribeMember(input: SubscribeMemberInput): Promise<void> {
  const cfg = readConfig()
  // The /public endpoint mirrors what Listmonk's hosted form does; it triggers
  // double-opt-in if the list is configured for it.
  const res = await fetch(`${cfg.baseUrl}/api/public/subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      name: input.name ?? input.email.split("@")[0],
      list_uuids: [],
      list_ids: [cfg.newsletterListId],
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Listmonk public subscription → ${res.status}: ${body}`)
  }
}

export interface SendTransactionalInput {
  email: string
  /** Pre-rendered HTML to send as-is. */
  bodyHtml: string
  /** Subject line. */
  subject: string
}

/**
 * Send a one-off transactional email to a single subscriber via Listmonk's
 * /api/tx endpoint. Requires LISTMONK_WELCOME_TX_TEMPLATE_ID to point at a
 * passthrough template (body: `{{ .Tx.Data.body | safeHTML }}`).
 *
 * Used by the mid-drip welcome flow: when a subscriber confirms during a live
 * Volume drip, we render the backfill email and send it via this path.
 */
export async function sendTransactional(input: SendTransactionalInput): Promise<void> {
  const cfg = readConfig()
  if (!cfg.welcomeTxTemplateId) {
    throw new Error("LISTMONK_WELCOME_TX_TEMPLATE_ID is not set; cannot send transactional email")
  }
  await listmonkFetch("/tx", {
    method: "POST",
    body: JSON.stringify({
      subscriber_email: input.email,
      template_id: cfg.welcomeTxTemplateId,
      from_email: cfg.fromEmail,
      content_type: "html",
      messenger: "email",
      headers: [{ Subject: input.subject }],
      data: { body: input.bodyHtml, subject: input.subject },
    }),
  })
}
