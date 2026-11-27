"use client"

import React from "react"

import { Button } from "@/components/ui/button"
import { ProviderLogo } from "@/plugins/sso/components/ProviderLogo"
import { cn } from "@/utilities/utils"

/**
 * Each provider's button as its branding guidelines draw it: Google white with a grey outline,
 * or its dark variant; Discord's blurple; Destiny.gg's near-black with its blue on hover. The
 * colors are the SSO plugin's tokens (`providerColors.css`), shared with the admin's login page. The tokens switch with the theme themselves; the `dark:`
 * copies are there to outrank the outline Button's own dark fills.
 */
const BRANDS = {
  google:
    "border-(--sso-google-border) bg-(--sso-google-bg) text-(--sso-google-text) hover:bg-(--sso-google-hover) hover:text-(--sso-google-text) dark:border-(--sso-google-border) dark:bg-(--sso-google-bg) dark:hover:bg-(--sso-google-hover)",
  discord:
    "border-(--sso-discord-bg) bg-(--sso-discord-bg) text-(--sso-discord-text) hover:bg-(--sso-discord-hover) hover:text-(--sso-discord-text) dark:border-(--sso-discord-bg) dark:bg-(--sso-discord-bg) dark:hover:bg-(--sso-discord-hover)",
  destiny:
    "border-(--sso-destiny-border) bg-(--sso-destiny-bg) text-(--sso-destiny-text) hover:border-(--sso-destiny-hover-border) hover:bg-(--sso-destiny-hover) hover:text-(--sso-destiny-text) dark:border-(--sso-destiny-border) dark:bg-(--sso-destiny-bg) dark:hover:bg-(--sso-destiny-hover)",
} as const

type Brand = keyof typeof BRANDS

const isBrand = (id: string): id is Brand => id in BRANDS

export interface ProviderSignInButtonProps {
  /** The provider's id: `google`, `discord` or `destiny` get their own look. */
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
      variant="outline"
      size={iconOnly && logo ? "icon-lg" : "lg"}
      disabled={disabled}
      onClick={onClick}
      data-provider={provider}
      title={iconOnly && logo ? `Sign in with ${label}` : undefined}
      className={cn(
        "font-medium",
        iconOnly && logo ? "size-10" : "h-10 justify-start gap-3 px-4",
        isBrand(provider) && BRANDS[provider],
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
