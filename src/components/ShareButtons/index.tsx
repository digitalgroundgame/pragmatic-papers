"use client"

import {
  BlueskyIcon,
  LinkedinIcon,
  RedditIcon,
  ThreadsIcon,
  XIcon,
} from "@/components/SocialLinks/icons"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/utilities/utils"
import { Check, Copy, Mail, Share2 } from "lucide-react"
import { useState } from "react"

interface ShareButtonsProps {
  url: string
  title: string
  className?: string
}

export function ShareButtons({ url, title, className }: ShareButtonsProps): React.ReactElement {
  const [copied, setCopied] = useState(false)

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
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Share" className={cn(className)} />
        }
      >
        <Share2 className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              readOnly
              value={url}
              className="border-input bg-background text-muted-foreground h-7 min-w-0 flex-1 truncate rounded-sm border px-2 text-xs outline-none"
            />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={copied ? "Copied!" : "Copy link"}
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {shareLinks.map(({ label, icon: Icon, href }) => (
              <Button
                key={label}
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
