import { Globe } from "lucide-react"
import type { FC, SVGProps } from "react"
import type { SocialLinkPlatform } from "./detectPlatform"
import {
  BlueskyIcon,
  DiscordIcon,
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  RedditIcon,
  SubstackIcon,
  TiktokIcon,
  TwitchIcon,
  XIcon,
  YoutubeIcon,
} from "./icons"

export type SocialIconKey = SocialLinkPlatform | "generic"

/**
 * Shared platform → icon component map used by both the footer/header
 * `SocialLinks` and the author-display `AuthorLinks`. Keeping it exhaustive over
 * `SocialLinkPlatform` means adding a platform to `detectPlatform.ts` forces a
 * matching icon entry here (a missing key is a type error).
 */
export const socialIconMap: Record<SocialIconKey, FC<SVGProps<SVGSVGElement>>> = {
  twitter: XIcon,
  instagram: InstagramIcon,
  reddit: RedditIcon,
  bluesky: BlueskyIcon,
  substack: SubstackIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  twitch: TwitchIcon,
  discord: DiscordIcon,
  github: GithubIcon,
  linkedin: LinkedinIcon,
  generic: Globe,
}
