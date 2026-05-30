export type SocialLinkPlatform =
  | "bluesky"
  | "instagram"
  | "reddit"
  | "substack"
  | "tiktok"
  | "twitter"
  | "youtube"

interface DomainRule {
  root: string
  subdomains?: readonly string[]
}

interface PlatformRule {
  platform: SocialLinkPlatform
  domains: readonly DomainRule[]
}

const RULES: readonly PlatformRule[] = [
  {
    platform: "twitter",
    domains: [
      { root: "twitter.com", subdomains: ["www", "mobile"] },
      { root: "x.com", subdomains: ["www"] },
    ],
  },
  {
    platform: "instagram",
    domains: [{ root: "instagram.com", subdomains: ["www"] }],
  },
  {
    platform: "reddit",
    domains: [{ root: "reddit.com", subdomains: ["www", "old", "new", "np", "amp"] }],
  },
  {
    platform: "bluesky",
    domains: [{ root: "bsky.app" }],
  },
  {
    platform: "substack",
    domains: [{ root: "substack.com", subdomains: ["www"] }],
  },
  {
    platform: "youtube",
    domains: [{ root: "youtube.com", subdomains: ["www", "m"] }, { root: "youtu.be" }],
  },
  {
    platform: "tiktok",
    domains: [{ root: "tiktok.com", subdomains: ["www", "m"] }],
  },
] as const

function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

const ACCEPTED_PROTOCOLS = ["http:", "https:"] as const
type AcceptedProtocol = (typeof ACCEPTED_PROTOCOLS)[number]

function parseURL(input: string): URL | null {
  const str = input.trim()
  if (!str) return null
  if (!URL.canParse(str)) return null

  const url = URL.parse(str)
  if (!url) return null
  if (!ACCEPTED_PROTOCOLS.includes(url.protocol as AcceptedProtocol)) return null

  return url
}

const hostnames: ReadonlyMap<string, SocialLinkPlatform> = (() => {
  const map = new Map<string, SocialLinkPlatform>()

  for (const rule of RULES) {
    for (const domain of rule.domains) {
      const root = normalizeHost(domain.root)
      map.set(root, rule.platform)

      for (const sub of domain.subdomains ?? []) {
        map.set(`${normalizeHost(sub)}.${root}`, rule.platform)
      }
    }
  }

  return map
})()

/**
 * Detects the social media platform from a given URL string for the purpose
 * of rendering social link icons. Independent of embed support.
 *
 * @param input - The URL string to analyze.
 * @returns The detected platform or null if not recognized.
 */
export function detectSocialLinkPlatform(input: string): SocialLinkPlatform | null {
  const url = parseURL(input)
  if (!url) return null
  return hostnames.get(normalizeHost(url.hostname)) ?? null
}
