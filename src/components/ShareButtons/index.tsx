"use client"

import {
  BlueskyIcon,
  FacebookIcon,
  LinkedinIcon,
  RedditIcon,
  ThreadsIcon,
  XIcon,
} from "@/components/SocialLinks/icons"
import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/ui/link-button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, Copy, Mail, Share2 } from "lucide-react"
import { useRef, useState } from "react"

interface ShareButtonsProps {
  url: string
  title: string
  className?: string
}

export function ShareButtons({ url, title, className }: ShareButtonsProps): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const shareLinks = [
    {
      label: "Share on X",
      icon: XIcon,
      href: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      label: "Share on Bluesky",
      icon: BlueskyIcon,
      href: `https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      label: "Share on Facebook",
      icon: FacebookIcon,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "Share on Threads",
      icon: ThreadsIcon,
      href: `https://www.threads.net/intent/post?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      label: "Share on Reddit",
      icon: RedditIcon,
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      label: "Share on LinkedIn",
      icon: LinkedinIcon,
      href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      label: "Share via Email",
      icon: Mail,
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
    },
  ]

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // clipboard unavailable in some environments (headless, sandboxed iframes)
      return
    }
    setCopied(true)
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label="Share" className={className} />
        }
      >
        <Share2 className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="grid grid-cols-7 gap-1">
          <input
            readOnly
            value={url}
            className="border-input bg-background text-muted-foreground col-span-6 h-8 min-w-0 truncate rounded-sm border px-2 text-xs outline-none"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={copied ? "Copied!" : "Copy link"}
            onClick={handleCopy}
            className="w-full"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
          {shareLinks.map(({ label, icon: Icon, href }) => (
            <LinkButton
              key={label}
              variant="ghost"
              size="icon"
              aria-label={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <Icon className="size-5" />
            </LinkButton>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
