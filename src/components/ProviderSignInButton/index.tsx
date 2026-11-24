"use client"

import { cva } from "class-variance-authority"
import React from "react"

import { Button } from "@/components/ui/button"
import { ProviderLogo } from "@/plugins/sso/components/ProviderLogo"
import { cn } from "@/utilities/utils"

/**
 * Each provider's button as its branding guidelines draw it, in the `provider-*` tokens of
 * globals.css (dark mode is in the tokens, so no `dark:` classes here): Google white with a
 * grey outline, or its dark variant; Discord's blurple; Destiny.gg's near-black with its blue
 * on hover; Digital Ground Game's black and white, like its wordmark. A provider without its
 * own look gets the outline button's colors.
 */
const providerSignInButton = cva("font-medium", {
  variants: {
    provider: {
      google:
        "border-provider-google-border bg-provider-google text-provider-google-foreground hover:bg-provider-google-hover hover:text-provider-google-foreground",
      discord:
        "border-provider-discord-border bg-provider-discord text-provider-discord-foreground hover:bg-provider-discord-hover hover:text-provider-discord-foreground",
      destiny:
        "border-provider-destiny-border bg-provider-destiny text-provider-destiny-foreground hover:border-provider-destiny-accent hover:bg-provider-destiny-hover hover:text-provider-destiny-foreground",
      digitalgroundgame:
        "border-provider-digitalgroundgame-border bg-provider-digitalgroundgame text-provider-digitalgroundgame-foreground hover:bg-provider-digitalgroundgame-hover hover:text-provider-digitalgroundgame-foreground",
      other: "",
    },
    shape: {
      /** The logo alone, in a square. */
      icon: "size-10",
      label: "h-10 justify-start gap-3 px-4",
    },
  },
  defaultVariants: { provider: "other", shape: "label" },
})

type Brand = "google" | "discord" | "destiny" | "digitalgroundgame"

const BRANDS: readonly string[] = [
  "google",
  "discord",
  "destiny",
  "digitalgroundgame",
] satisfies Brand[]

const isBrand = (id: string): id is Brand => BRANDS.includes(id)

export interface ProviderSignInButtonProps {
  /** The provider's id: `google`, `discord`, `destiny` or `digitalgroundgame` get their own look. */
  provider: string
  label: string
  onClick: () => void
  disabled?: boolean
  /** Just the logo, in a square: for a row of them beside a line of text. */
  iconOnly?: boolean
  className?: string
}

/** "Sign in with Google", in the provider's own colors and with its logo. */
export const ProviderSignInButton: React.FC<ProviderSignInButtonProps> = ({
  provider,
  label,
  onClick,
  disabled,
  iconOnly = false,
  className,
}) => {
  const logo = isBrand(provider) ? (
    <span className="inline-flex size-5 shrink-0 [&_svg]:size-full">
      <ProviderLogo provider={provider} />
    </span>
  ) : null
  return (
    <Button
      type="button"
      // A branded button brings all of its own colors; the outline variant's include
      // `dark:` ones that would win over them.
      variant={isBrand(provider) ? "default" : "outline"}
      size={iconOnly && logo ? "icon-lg" : "lg"}
      disabled={disabled}
      onClick={onClick}
      data-provider={provider}
      title={iconOnly && logo ? `Sign in with ${label}` : undefined}
      className={cn(
        providerSignInButton({
          provider: isBrand(provider) ? provider : "other",
          shape: iconOnly && logo ? "icon" : "label",
        }),
        className,
      )}
    >
      {logo}
      {iconOnly && logo ? (
        <span className="sr-only">Sign in with {label}</span>
      ) : (
        <>Sign in with {label}</>
      )}
    </Button>
  )
}
