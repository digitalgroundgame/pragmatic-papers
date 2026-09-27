import { render } from "@react-email/render"
import type { ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Article } from "@/payload-types"
import { VolumeArticleEmail, type VolumeArticleEmailProps } from "../VolumeArticle"

const SITE = "https://site.example.com"
const volume = { title: "Vol Title", volumeNumber: 3, slug: "vol-3" }

function makeArticle(overrides: Record<string, unknown> = {}): Article {
  return {
    id: 1,
    title: "The Written Word",
    slug: "the-written-word",
    publishedAt: "2026-06-20T12:00:00.000Z",
    meta: { description: "Every platform makes choices about formatting." },
    heroImage: {
      id: 9,
      url: "/api/media/file/hero.png",
      sizes: { small: { url: "/api/media/file/hero-600x300.png", width: 600, height: 300 } },
    },
    authors: [
      {
        id: 2,
        name: "Teagan Wordsmith",
        profileImage: { id: 7, sizes: { square: { url: "/api/media/file/teagan.png" } } },
      },
      {
        id: 3,
        name: "Sienna Scribe",
        profileImage: { id: 8, sizes: { square: { url: "https://cdn.example.com/sienna.png" } } },
      },
    ],
    topics: [
      { id: 4, name: "Policy" },
      { id: 5, name: "Economics" },
    ],
    ...overrides,
  } as unknown as Article
}

function email(props: Partial<VolumeArticleEmailProps> = {}): ReactElement {
  return VolumeArticleEmail({
    article: makeArticle(),
    volume,
    dayIndex: 2,
    totalDays: 5,
    siteUrl: SITE,
    ...props,
  })
}

// Pretty output reflows text across lines, so assertions load the compact HTML.
// It goes into the live document because jest-dom rejects nodes from a
// DOMParser document, which has no window.
async function renderEmail(props: Partial<VolumeArticleEmailProps> = {}): Promise<Document> {
  const html = await render(email(props))
  document.documentElement.innerHTML = html.replace(/<!DOCTYPE[^>]*>|<\/?html[^>]*>/gi, "")
  return document
}

function linksTo(doc: Document, href: string): HTMLAnchorElement[] {
  return [...doc.querySelectorAll<HTMLAnchorElement>("a")].filter(
    (a) => a.getAttribute("href") === href,
  )
}

// formatDistanceToNow reads the clock, so pin it for stable output.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("VolumeArticleEmail", () => {
  it("renders the full email", async () => {
    expect(await render(email(), { pretty: true })).toMatchSnapshot()
  })

  it("shows the volume, day, title, byline, age, excerpt and topics", async () => {
    const doc = await renderEmail()
    const text = doc.body.textContent ?? ""

    expect(text).toContain("Volume 3 · Day 2 of 5")
    expect(text).toContain("The Written Word")
    expect(text).toContain("By Teagan Wordsmith and Sienna Scribe")
    expect(text).toContain("3 months ago")
    expect(text).toContain("Every platform makes choices about formatting.")
    expect(text).toContain("Policy · Economics")
  })

  it("uses the title and excerpt as the inbox preview", async () => {
    const doc = await renderEmail()
    expect(doc.title).toContain("The Written Word — Every platform makes choices about formatting.")
  })

  it("links the hero, title and call to action to the article", async () => {
    const doc = await renderEmail()
    const articleLinks = linksTo(doc, `${SITE}/articles/the-written-word`)

    expect(articleLinks).toHaveLength(3)
    expect(articleLinks[2]).toHaveTextContent("Read on The Pragmatic Papers")
  })

  it("serves the hero image through /_next/image at 1080px", async () => {
    const doc = await renderEmail()
    const hero = doc.querySelector('img[alt="The Written Word"]')

    const params = new URLSearchParams({ url: "/api/media/file/hero.png", w: "1080", q: "80" })
    expect(hero).toHaveAttribute("src", `${SITE}/_next/image?${params.toString()}`)
    expect(hero).toHaveAttribute("width", "600")
    expect(hero).toHaveAttribute("height", "300")
  })

  it("makes relative avatar URLs absolute and leaves absolute ones alone", async () => {
    const doc = await renderEmail()
    const avatars = [...doc.querySelectorAll('img[width="24"]')].map((img) =>
      img.getAttribute("src"),
    )

    expect(avatars).toEqual([
      `${SITE}/api/media/file/teagan.png`,
      "https://cdn.example.com/sienna.png",
    ])
  })

  it("prefixes a slash when an avatar path has none", async () => {
    const article = makeArticle({
      authors: [
        { id: 2, name: "Teagan", profileImage: { id: 7, sizes: { square: { url: "a.png" } } } },
      ],
    })
    const doc = await renderEmail({ article })

    expect(doc.querySelector('img[width="24"]')).toHaveAttribute("src", `${SITE}/a.png`)
  })

  it("links the footer to the volume and keeps Listmonk's unsubscribe placeholder", async () => {
    const doc = await renderEmail()

    expect(linksTo(doc, `${SITE}/volumes/vol-3`)[0]).toHaveTextContent("Volume 3")
    expect(linksTo(doc, "{{ UnsubscribeURL }}")[0]).toHaveTextContent("unsubscribe")
  })

  it("falls back when optional fields are missing or unpopulated", async () => {
    const article = makeArticle({
      heroImage: 9,
      meta: {},
      authors: [3],
      publishedAt: null,
      topics: [],
    })
    const doc = await renderEmail({ article })
    const text = doc.body.textContent ?? ""

    expect(doc.querySelector('img[alt="The Written Word"]')).not.toBeInTheDocument()
    expect(text).toContain("A new piece from Volume 3.")
    expect(text).not.toContain("By ")
    expect(text).not.toContain("ago")
    expect(text).not.toContain("·  ·")
  })

  it("renders the byline without avatars when no author has a profile image", async () => {
    const article = makeArticle({ authors: [{ id: 2, name: "Teagan Wordsmith" }] })
    const doc = await renderEmail({ article })

    expect(doc.body).toHaveTextContent("By Teagan Wordsmith")
    expect(doc.querySelector('img[width="24"]')).not.toBeInTheDocument()
  })
})
