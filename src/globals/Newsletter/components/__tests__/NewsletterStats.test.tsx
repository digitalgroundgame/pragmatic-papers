import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { NewsletterCampaign } from "@/integrations/listmonk"

import type { NewsletterOverview } from "../load"
import { NewsletterStats } from "../NewsletterStats"

const campaign = (overrides: Partial<NewsletterCampaign>): NewsletterCampaign => ({
  id: 1,
  name: "Volume 40, Friday",
  subject: "What the jobs report says",
  status: "finished",
  sendAt: "2026-10-09T14:00:00Z",
  sent: 200,
  toSend: 200,
  views: 50,
  clicks: 9,
  bounces: 0,
  ...overrides,
})

const connected = (overrides: Partial<Extract<NewsletterOverview, { connected: true }>> = {}) =>
  ({
    connected: true,
    adminUrl: "https://list.example.com/admin",
    list: {
      ok: true,
      data: { name: "Newsletter", total: 1342, confirmed: 1204, unconfirmed: 61, unsubscribed: 77 },
    },
    signups: { ok: true, data: [] },
    campaigns: { ok: true, data: [] },
    ...overrides,
  }) satisfies NewsletterOverview

describe("NewsletterStats", () => {
  it("shows the list's counts, formatted, and links to Listmonk", () => {
    render(<NewsletterStats overview={connected()} />)
    expect(screen.getByRole("heading", { name: "Newsletter" })).toBeInTheDocument()
    expect(screen.getByText("Subscribers").nextSibling).toHaveTextContent("1,204")
    expect(screen.getByText("Awaiting confirmation").nextSibling).toHaveTextContent("61")
    expect(screen.getByText("Unsubscribed").nextSibling).toHaveTextContent("77")
    expect(screen.getByText("Everyone on the list").nextSibling).toHaveTextContent("1,342")
    expect(screen.getByRole("link", { name: "Open Listmonk" })).toHaveAttribute(
      "href",
      "https://list.example.com/admin",
    )
  })

  it("says so when there are no signups or campaigns yet", () => {
    render(<NewsletterStats overview={connected()} />)
    expect(screen.getByText("No one has signed up yet.")).toBeInTheDocument()
    expect(screen.getByText("No campaigns yet.")).toBeInTheDocument()
  })

  it("lists signups with their status on the list, blocklisting overriding it, in Pacific time", () => {
    render(
      <NewsletterStats
        overview={connected({
          signups: {
            ok: true,
            data: [
              {
                id: 2,
                email: "reader@example.com",
                createdAt: "2026-10-10T18:04:00Z",
                subscriptionStatus: "unconfirmed",
                status: "enabled",
              },
              {
                id: 1,
                email: "spam@example.net",
                createdAt: "2026-10-08T11:00:00Z",
                subscriptionStatus: "confirmed",
                status: "blocklisted",
              },
            ],
          },
        })}
      />,
    )
    const table = within(screen.getByRole("table", { name: "Recent signups" }))
    const reader = table.getByRole("row", { name: /reader@example\.com/ })
    expect(reader).toHaveTextContent("unconfirmed")
    expect(reader).toHaveTextContent("Oct 10, 2026, 11:04 AM")
    expect(table.getByRole("row", { name: /spam@example\.net/ })).toHaveTextContent("blocklisted")
  })

  it("shows each campaign's sends with open and click rates", () => {
    render(
      <NewsletterStats
        overview={connected({
          campaigns: {
            ok: true,
            data: [
              campaign({ id: 3, name: "Sending now", status: "running", sent: 120, toSend: 1200 }),
              campaign({
                id: 2,
                name: "Scheduled",
                status: "scheduled",
                sent: 0,
                views: 0,
                clicks: 0,
              }),
              campaign({ id: 1, name: "Draft", status: "draft", sendAt: null, sent: 0 }),
            ],
          },
        })}
      />,
    )
    const table = within(screen.getByRole("table", { name: "Recent campaigns" }))
    const running = within(table.getByRole("row", { name: /Sending now/ }))
    expect(running.getByText("120 of 1,200")).toBeInTheDocument()
    expect(running.getByText("50 (42%)")).toBeInTheDocument()
    expect(running.getByText("9 (8%)")).toBeInTheDocument()
    // Nothing sent: plain counts, no rate.
    const scheduled = table.getByRole("row", { name: /Scheduled/ })
    expect(scheduled).toHaveTextContent("Oct 9, 2026, 7:00 AM")
    expect(scheduled).not.toHaveTextContent("%")
    expect(table.getByRole("row", { name: /Draft/ })).toHaveTextContent("—")
  })

  it("names the permission a refused part needs, and keeps the parts it could read", () => {
    render(
      <NewsletterStats
        overview={connected({
          list: { ok: false, reason: "forbidden" },
          signups: { ok: false, reason: "forbidden" },
          campaigns: { ok: false, reason: "forbidden" },
        })}
      />,
    )
    expect(screen.getByText(/allowed to read the newsletter list/)).toHaveTextContent(
      "lists:get_all",
    )
    expect(screen.getByText(/allowed to read subscribers/)).toHaveTextContent("subscribers:get_all")
    expect(screen.getByText(/allowed to read campaigns/)).toHaveTextContent("campaigns:get_all")
    expect(screen.queryByText("Subscribers")).not.toBeInTheDocument()
  })

  it("asks for a reload when Listmonk fails for another reason", () => {
    render(<NewsletterStats overview={connected({ list: { ok: false, reason: "error" } })} />)
    expect(
      screen.getByText("Couldn't read the newsletter list from Listmonk. Reload to try again."),
    ).toBeInTheDocument()
    expect(screen.getByText("No campaigns yet.")).toBeInTheDocument()
  })

  it("points to Integrations, with no Listmonk link, when it isn't connected", () => {
    render(<NewsletterStats overview={{ connected: false }} />)
    expect(screen.getByText(/isn't connected in this environment/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Integrations" })).toHaveAttribute(
      "href",
      "/admin/globals/integrations",
    )
    expect(screen.queryByRole("link", { name: "Open Listmonk" })).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
