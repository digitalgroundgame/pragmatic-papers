import { normalizeExternalUrl } from "@/components/Authors/AuthorLinks"
import type { MenuField } from "@/payload-types"
import { cn } from "@/utilities/utils"
import { Globe } from "lucide-react"
import type { FC, SVGProps } from "react"
import { buttonVariants } from "../ui/button"
import { detectSocialLinkPlatform, type SocialLinkPlatform } from "./detectPlatform"
import {
  BlueskyIcon,
  InstagramIcon,
  RedditIcon,
  SubstackIcon,
  TiktokIcon,
  XIcon,
  YoutubeIcon,
} from "./icons"

type SocialIconKey = SocialLinkPlatform | "generic"

const iconMap: Record<SocialIconKey, FC<SVGProps<SVGSVGElement>>> = {
  twitter: XIcon,
  instagram: InstagramIcon,
  reddit: RedditIcon,
  bluesky: BlueskyIcon,
  substack: SubstackIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  generic: Globe,
}

interface SocialLinksProps extends React.HTMLAttributes<HTMLDivElement> {
  parentId?: number
  socials?: MenuField
}

export function SocialLinks({
  "aria-label": ariaLabel,
  parentId,
  className,
  socials,
}: SocialLinksProps): React.ReactElement | null {
  if (!socials?.length) return null

  const links = socials.flatMap(({ link, id }) => {
    if (link?.type !== "custom" || !link.url) return []
    const href = normalizeExternalUrl(link.url)
    if (!href) return []
    const platform: SocialIconKey = detectSocialLinkPlatform(href) ?? "generic"
    return [{ id: id || href, href, platform, label: link.label }]
  })

  if (!links.length) return null

  return (
    <nav
      aria-label={ariaLabel || "Social Links"}
      className={cn("flex flex-row items-center gap-2", className)}
    >
      <ul className="flex flex-row items-center gap-2">
        {links.map(({ id, href, platform, label }) => {
          const Icon = iconMap[platform] ?? Globe
          return (
            <li key={`${parentId}-${id}`}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm", className }))}
                title={label || href}
              >
                <span className="sr-only">{label || href}</span>
                <Icon className="size-5" />
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
