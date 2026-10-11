"use client"

import { useSearchParams } from "next/navigation"
import React, { useState } from "react"

import { PROVIDER_LABELS } from "../constants"
import type { SsoProviderId } from "../types"

/** What Better Auth puts in `?error=` when it sends someone back to the login page. */
const ERRORS: Record<string, string> = {
  signup_disabled:
    "No account here uses that address. Ask an admin to create one, then sign in again.",
  account_not_linked:
    "That provider hasn't verified your email address, so it can't be matched to your account.",
  email_not_found: "That provider didn't share an email address.",
}

const BUTTON_CLASS =
  "btn btn--icon-style-without-border btn--size-large btn--withoutPopup btn--style-secondary btn--no-margin"

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
    <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
      {error ? <p role="alert">{error}</p> : null}
      {providers.map((provider) => (
        // Payload's own button classes rather than its `Button`: importing @payloadcms/ui
        // here breaks the Storybook build, and these render the same in the admin.
        <button
          key={provider}
          type="button"
          className={pending === null ? BUTTON_CLASS : `${BUTTON_CLASS} btn--disabled`}
          disabled={pending !== null}
          onClick={() => void signIn(provider)}
        >
          <span className="btn__content">
            <span className="btn__label">
              {pending === provider ? "Redirecting…" : `Sign in with ${PROVIDER_LABELS[provider]}`}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
