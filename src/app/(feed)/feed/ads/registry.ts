// TODO: Move ads to a Payload `Ads` collection with per-ad scheduling
// (activeFrom, activeUntil), category, and per-category rotation rules,
// so editors can rotate slots without a deploy. The migration is
// mechanical — replace this import with a server fetch over the same
// `AdSlot` shape, then keep the rest of the feed plumbing as-is.

export type AdVariant = "donation" | "promo" | "external"

export interface AdSlot {
  id: string
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  variant: AdVariant
  image?: { src: string; alt: string }
}

export const FEED_AD_INTERVAL = 5

export const FEED_ADS: AdSlot[] = [
  {
    id: "support",
    eyebrow: "Support us",
    title: "Pragmatic Papers is reader-funded",
    body: "If our writing is worth your time, please consider chipping in. Every contribution keeps the lights on.",
    ctaLabel: "Donate",
    ctaHref: "/donate",
    variant: "donation",
  },
  {
    id: "dgg-promo",
    eyebrow: "From our friends",
    title: "Built by Digital Ground Game",
    body: "We craft software that respects your attention. See what else we're working on.",
    ctaLabel: "Visit Digital Ground Game",
    ctaHref: "https://digitalgroundgame.com",
    variant: "external",
  },
]
