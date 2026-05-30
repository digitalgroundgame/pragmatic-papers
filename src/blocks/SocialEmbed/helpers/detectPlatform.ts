import type { SocialPlatform } from "@/payload-types"

interface DomainRule {
  root: string
  subdomains?: readonly string[]
}

interface PlatformRule {
  platform: SocialPlatform
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
    platform: "youtube",
    domains: [{ root: "youtube.com", subdomains: ["www", "m"] }, { root: "youtu.be" }],
  },
  {
    platform: "bluesky",
    domains: [{ root: "bsky.app" }],
  },
  {
    platform: "reddit",
    domains: [{ root: "reddit.com", subdomains: ["www", "old", "new", "np", "amp"] }],
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

/**
 * Parses a given string and returns a URL object if the string is a valid,
 * accepted URL. Only URLs with 'http:' or 'https:' protocols are allowed.
 *
 * @param input - The string to attempt to parse as a URL.
 * @returns A URL object if parsing is successful and protocol is accepted; otherwise, null.
 */
function parseURL(input: string): URL | null {
  const str = input.trim()
  if (!str) return null
  if (!URL.canParse(str)) return null

  const url = URL.parse(str)
  if (!url) return null
  if (!ACCEPTED_PROTOCOLS.includes(url.protocol as AcceptedProtocol)) return null

  return url
}

/**
 * A read-only map of normalized hostnames to their associated social platforms.
 *
 * This map is built from the RULES constant, which contains platform-specific
 * domain rules listing the root domains and accepted subdomains for each social
 * platform. Each entry in the map represents either a root domain (e.g., 'twitter.com')
 * or a subdomain-root combination (e.g., 'www.twitter.com'), matched in lowercase,
 * and points to its corresponding platform (e.g., 'twitter').
 *
 * This structure enables fast lookup of a platform based on a given, normalized hostname.
 */
const hostnames: ReadonlyMap<string, SocialPlatform> = (() => {
  const map = new Map<string, SocialPlatform>()

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
 * Detects the social media platform from a given input string.
 *
 * @param input - The input string to analyze.
 * @returns The detected platform or null if not recognized.
 */
export function detectPlatform(input: string): SocialPlatform | null {
  const url = parseURL(input)
  if (!url) return null
  const host = normalizeHost(url.hostname)
  return hostnames.get(host) ?? null
}
