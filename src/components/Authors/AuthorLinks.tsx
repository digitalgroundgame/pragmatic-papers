import { GithubIcon, LinkedinIcon, XIcon } from "@/components/SocialLinks/icons"
import type { MenuField } from "@/payload-types"
import { cn } from "@/utilities/utils"
import { Globe } from "lucide-react"

export type SocialIconKey = "twitter" | "linkedin" | "github" | "generic"

export const SocialIconMap = {
  twitter: XIcon,
  linkedin: LinkedinIcon,
  github: GithubIcon,
  generic: Globe,
}

export interface AuthorSocialLink {
  id: string
  href: string
  icon: SocialIconKey
  label?: string | null
}

export interface AuthorLinksProps {
  className?: string
  socials?: MenuField
}

export function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  // If the string already looks like it has a scheme, leave it as-is
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed

  // Otherwise, assume HTTPS and strip leading slashes
  return `https://${trimmed.replace(/^\/+/, "")}`
}

export function deriveAuthorSocialLinks(entries: MenuField): AuthorSocialLink[] {
  if (!entries) return []
  const links: AuthorSocialLink[] = []

  for (const { link, id } of entries) {
    if (!link) continue

    if (link.type !== "custom" || !link.url) continue

    const href = normalizeExternalUrl(link.url)
    if (!href) continue

    let host = ""
    try {
      const urlObj = new URL(href)
      host = urlObj.hostname.toLowerCase()
    } catch {
      // Non-HTTP(S) URL like mailto:, just treat as generic
    }

    let icon: SocialIconKey = "generic"

    if (host.includes("twitter.com") || host.endsWith("x.com")) {
      icon = "twitter"
    } else if (host.includes("linkedin.com")) {
      icon = "linkedin"
    } else if (host.includes("github.com")) {
      icon = "github"
    }

    links.push({
      id: id || href,
      href,
      icon,
      label: link.label,
    })
  }

  return links
}

export const AuthorLinks: React.FC<AuthorLinksProps> = ({ className, socials }) => {
  if (!socials) return null
  const links = deriveAuthorSocialLinks(socials)
  if (!links.length) return null
  return (
    <nav aria-label="Author Links" className={cn("flex flex-wrap gap-3", className)}>
      {links.map((link) => {
        const Icon = SocialIconMap[link.icon] || Globe
        return (
          <a
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={link.href}
          >
            <span className="sr-only">{link.label || link.href}</span>
            <Icon className="h-4 w-4" />
          </a>
        )
      })}
    </nav>
  )
}
