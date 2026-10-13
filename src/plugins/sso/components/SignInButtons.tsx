"use client"

import { useSearchParams } from "next/navigation"
import React, { useState } from "react"

import { PROVIDER_LABELS } from "../constants"
import type { SsoProviderId } from "../types"
import { ProviderLogo } from "./ProviderLogo"
import "./SignInButtons.css"

/** What Better Auth puts in `?error=` when it sends someone back to the login page. */
const ERRORS: Record<string, string> = {
  signup_disabled:
    "No account here uses that address. Ask an admin to create one, then sign in again.",
  account_not_linked:
    "That provider hasn't verified your email address, so it can't be matched to your account.",
  // Destiny.gg shares no address, so this is its "no account here".
  email_not_found:
    "No account here is linked to that sign-in. Ask an admin to add it to your user, then sign in again.",
}

const FALLBACK_ERROR = "Sign-in didn't complete. Try again, or use your email and password."

export interface SignInButtonsProps {
  providers: SsoProviderId[]
  /** Better Auth's base path, e.g. `/api/auth`. */
  authPath: string
  /** Where a successful sign-in lands, e.g. `/admin`. */
  adminPath: string
}

export const SignInButtons: React.FC<SignInButtonsProps> = ({ providers, authPath, adminPath }) => {
  const errorCode = useSearchParams().get("error")
  const [pending, setPending] = useState<SsoProviderId | null>(null)
  const [failed, setFailed] = useState(false)

  const signIn = async (provider: SsoProviderId) => {
    setPending(provider)
    setFailed(false)
    try {
      const response = await fetch(`${authPath}/sign-in/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL: adminPath,
          errorCallbackURL: `${adminPath}/login`,
        }),
      })
      const { url } = (await response.json()) as { url?: string }
      if (!response.ok || !url) throw new Error("no redirect")
      window.location.assign(url)
    } catch {
      setPending(null)
      setFailed(true)
    }
  }

  const error = failed ? FALLBACK_ERROR : errorCode ? (ERRORS[errorCode] ?? FALLBACK_ERROR) : null

  return (
    <div className="sso-sign-in">
      {error ? (
        <p className="sso-sign-in__error" role="alert">
          {error}
        </p>
      ) : null}
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          className={`sso-sign-in__button sso-sign-in__button--${provider}`}
          disabled={pending !== null}
          onClick={() => void signIn(provider)}
        >
          <span className="sso-sign-in__logo">
            <ProviderLogo provider={provider} />
          </span>
          {pending === provider ? "Redirecting…" : `Sign in with ${PROVIDER_LABELS[provider]}`}
        </button>
      ))}
      <p className="sso-sign-in__divider">or use your email and password</p>
    </div>
  )
}
