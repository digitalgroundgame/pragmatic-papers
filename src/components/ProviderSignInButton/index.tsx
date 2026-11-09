"use client"

import React from "react"

import { Button } from "@/components/ui/button"
import { ProviderLogo } from "@/plugins/sso/components/ProviderLogo"
import { cn } from "@/utilities/utils"

/**
 * Each provider's button as its branding guidelines draw it (the admin's login page uses the
 * same colors, in `SignInButtons.css`): Google white with a grey outline, or its dark variant;
 * Discord's blurple; Destiny.gg's near-black with its blue on hover.
 */
const BRANDS = {
  google:
    "border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa] hover:text-[#1f1f1f] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20] dark:hover:text-[#e3e3e3]",
  discord:
    "border-[#5865f2] bg-[#5865f2] text-white hover:bg-[#4752c4] hover:text-white dark:border-[#5865f2] dark:bg-[#5865f2] dark:hover:bg-[#4752c4]",
  destiny:
    "border-[#1a1a1a] bg-[#1a1a1a] text-white hover:border-[#59aeea] hover:bg-[#262626] hover:text-white dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:hover:bg-[#262626]",
} as const

type Brand = keyof typeof BRANDS

const isBrand = (id: string): id is Brand => id in BRANDS

export interface ProviderSignInButtonProps {
  /** The provider's id: `google`, `discord` or `destiny` get their own look. */
  provider: string
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
}

/** "Sign in with Google", in the provider's own colors and with its logo. */
export const ProviderSignInButton: React.FC<ProviderSignInButtonProps> = ({
  provider,
  label,
  onClick,
  disabled,
  className,
}) => (
  <Button
    type="button"
    variant="outline"
    size="lg"
    disabled={disabled}
    onClick={onClick}
    data-provider={provider}
    className={cn("h-10 gap-3 px-4 font-medium", isBrand(provider) && BRANDS[provider], className)}
  >
    {isBrand(provider) ? (
      <span className="inline-flex size-5 shrink-0 [&_svg]:size-full">
        <ProviderLogo provider={provider} />
      </span>
    ) : null}
    Sign in with {label}
  </Button>
)
