import type { MenuField } from "@/payload-types"

export const navItems: MenuField = [
  { id: "n1", link: { type: "custom", url: "/articles", label: "Articles" } },
  { id: "n2", link: { type: "custom", url: "/volumes", label: "Volumes" } },
  { id: "n3", link: { type: "custom", url: "/topics", label: "Topics" } },
  { id: "n4", link: { type: "custom", url: "/about", label: "About" } },
]

export const socials: MenuField = [
  { id: "s1", link: { type: "custom", url: "https://bsky.app/profile/example", label: "Bluesky" } },
  { id: "s2", link: { type: "custom", url: "https://youtube.com/@example", label: "YouTube" } },
  { id: "s3", link: { type: "custom", url: "https://discord.gg/example", label: "Discord" } },
  { id: "s4", link: { type: "custom", url: "https://github.com/example", label: "GitHub" } },
]
