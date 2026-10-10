import type { NewsletterCampaign, NewsletterSignup } from "@/utilities/listmonk"

import type { NewsletterOverview, Section } from "./load"

const cell = {
  borderBottom: "1px solid var(--theme-elevation-200)",
  padding: "0.5rem 0.75rem 0.5rem 0",
  textAlign: "left",
  verticalAlign: "top",
} as const
const numeric = { ...cell, fontVariantNumeric: "tabular-nums", textAlign: "right" } as const
const muted = { color: "var(--theme-elevation-650)" }
const heading = { fontSize: "1rem", fontWeight: 600, margin: "1.5rem 0 0.5rem" }

// The newsletter team works on Pacific time, as the release train does.
const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Los_Angeles",
})
const count = new Intl.NumberFormat("en-US")

function formatDate(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : "—"
}

/** "312 (41%)": a count and its share of what was sent. */
function withRate(value: number, sent: number): string {
  if (sent === 0) return count.format(value)
  return `${count.format(value)} (${Math.round((value / sent) * 100)}%)`
}

/** What each part needs from the API user's role in Listmonk when it's refused. */
const PERMISSION = {
  list: "lists:get_all",
  signups: "subscribers:get_all",
  campaigns: "campaigns:get_all",
} as const

function Unavailable({
  section,
  what,
  permission,
}: {
  section: Extract<Section<unknown>, { ok: false }>
  what: string
  permission: string
}): React.ReactNode {
  return (
    <p style={muted}>
      {section.reason === "forbidden" ? (
        <>
          Listmonk&apos;s API user isn&apos;t allowed to read {what}. Give its role{" "}
          <code>{permission}</code> in Listmonk, under Users → User roles.
        </>
      ) : (
        <>Couldn&apos;t read {what} from Listmonk. Reload to try again.</>
      )}
    </p>
  )
}

function Stat({ label, value }: { label: string; value: number }): React.ReactNode {
  return (
    <div
      style={{
        border: "1px solid var(--theme-elevation-200)",
        borderRadius: "4px",
        padding: "0.75rem 1rem",
      }}
    >
      <dt style={{ ...muted, fontSize: "0.8125rem" }}>{label}</dt>
      <dd style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>{count.format(value)}</dd>
    </div>
  )
}

function Signups({ signups }: { signups: NewsletterSignup[] }): React.ReactNode {
  if (signups.length === 0) return <p style={muted}>No one has signed up yet.</p>
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        aria-labelledby="newsletter-signups-heading"
        style={{ borderCollapse: "collapse", fontSize: "0.875rem", width: "100%" }}
      >
        <thead>
          <tr>
            <th scope="col" style={cell}>
              Email
            </th>
            <th scope="col" style={cell}>
              Status
            </th>
            <th scope="col" style={cell}>
              Signed up
            </th>
          </tr>
        </thead>
        <tbody>
          {signups.map((s) => (
            <tr key={s.id}>
              <td style={cell}>{s.email}</td>
              <td style={cell}>
                {s.status === "blocklisted" ? "blocklisted" : s.subscriptionStatus}
              </td>
              <td style={cell}>{formatDate(s.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Campaigns({ campaigns }: { campaigns: NewsletterCampaign[] }): React.ReactNode {
  if (campaigns.length === 0) return <p style={muted}>No campaigns yet.</p>
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        aria-labelledby="newsletter-campaigns-heading"
        style={{ borderCollapse: "collapse", fontSize: "0.875rem", width: "100%" }}
      >
        <thead>
          <tr>
            <th scope="col" style={cell}>
              Campaign
            </th>
            <th scope="col" style={cell}>
              Status
            </th>
            <th scope="col" style={cell}>
              Sends
            </th>
            <th scope="col" style={numeric}>
              Sent
            </th>
            <th scope="col" style={numeric}>
              Opens
            </th>
            <th scope="col" style={numeric}>
              Clicks
            </th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td style={cell}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={muted}>{c.subject}</div>
              </td>
              <td style={cell}>{c.status}</td>
              <td style={cell}>{formatDate(c.sendAt)}</td>
              <td style={numeric}>
                {c.status === "running"
                  ? `${count.format(c.sent)} of ${count.format(c.toSend)}`
                  : count.format(c.sent)}
              </td>
              <td style={numeric}>{withRate(c.views, c.sent)}</td>
              <td style={numeric}>{withRate(c.clicks, c.sent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The newsletter at a glance on the admin dashboard: subscriber counts, the newest signups and
 * the latest campaigns, as Listmonk reports them.
 */
export function NewsletterStats({ overview }: { overview: NewsletterOverview }): React.ReactNode {
  return (
    <section aria-labelledby="newsletter-panel-heading" style={{ marginBottom: "2rem" }}>
      <div
        style={{
          alignItems: "baseline",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem 1rem",
          justifyContent: "space-between",
        }}
      >
        <h2 id="newsletter-panel-heading" style={{ fontSize: "1.25rem", margin: 0 }}>
          Newsletter
        </h2>
        {overview.connected && (
          <a href={overview.adminUrl} rel="noopener noreferrer" target="_blank">
            Open Listmonk
          </a>
        )}
      </div>

      {!overview.connected ? (
        <p style={muted}>
          Listmonk isn&apos;t connected in this environment. To set in the hosting environment:{" "}
          {overview.missing.map((name, i) => (
            <span key={name}>
              {i > 0 && ", "}
              <code>{name}</code>
            </span>
          ))}
        </p>
      ) : (
        <>
          {overview.list.ok ? (
            <dl
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
                margin: "1rem 0 0",
              }}
            >
              <Stat label="Subscribers" value={overview.list.data.confirmed} />
              <Stat label="Awaiting confirmation" value={overview.list.data.unconfirmed} />
              <Stat label="Unsubscribed" value={overview.list.data.unsubscribed} />
              <Stat label="Everyone on the list" value={overview.list.data.total} />
            </dl>
          ) : (
            <Unavailable
              section={overview.list}
              what="the newsletter list"
              permission={PERMISSION.list}
            />
          )}

          <h3 id="newsletter-signups-heading" style={heading}>
            Recent signups
          </h3>
          {overview.signups.ok ? (
            <Signups signups={overview.signups.data} />
          ) : (
            <Unavailable
              section={overview.signups}
              what="subscribers"
              permission={PERMISSION.signups}
            />
          )}

          <h3 id="newsletter-campaigns-heading" style={heading}>
            Recent campaigns
          </h3>
          {overview.campaigns.ok ? (
            <Campaigns campaigns={overview.campaigns.data} />
          ) : (
            <Unavailable
              section={overview.campaigns}
              what="campaigns"
              permission={PERMISSION.campaigns}
            />
          )}
        </>
      )}
    </section>
  )
}
