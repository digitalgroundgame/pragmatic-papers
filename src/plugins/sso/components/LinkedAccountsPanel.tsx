import React from "react"

import type { LinkedProvider } from "../types"
import { ProviderLogo } from "./ProviderLogo"
import "./LinkedAccounts.css"

/** What the provider's callback puts in `?error=` when a link doesn't take. */
const ERRORS: Record<string, string> = {
  account_already_linked_to_different_user:
    "That account is already linked to someone else here. They need to disconnect it first.",
  unable_to_link_account: "That provider wouldn't let the account be linked.",
}

const FALLBACK_ERROR = "Linking didn't complete. Try again."

export interface LinkedAccountsPanelProps {
  providers: LinkedProvider[]
  /** The provider a request is in flight for. */
  pending: string | null
  /** An `?error=` code from the provider's callback, or a request that failed here. */
  error: string | null
  onConnect: (provider: LinkedProvider["id"]) => void
  onDisconnect: (provider: LinkedProvider["id"]) => void
}

/**
 * The account page's list of sign-in providers, each with Connect or Disconnect. A linked
 * account signs this user in, whatever address it has.
 */
export const LinkedAccountsPanel: React.FC<LinkedAccountsPanelProps> = ({
  providers,
  pending,
  error,
  onConnect,
  onDisconnect,
}) => (
  <section className="sso-links" aria-labelledby="sso-links-heading">
    <h3 id="sso-links-heading" className="sso-links__heading">
      Linked accounts
    </h3>
    <p className="sso-links__description">
      Sign in with any account linked here, as well as with your email and password.
    </p>
    {error ? (
      <p className="sso-links__error" role="alert">
        {ERRORS[error] ?? FALLBACK_ERROR}
      </p>
    ) : null}
    <ul className="sso-links__list">
      {providers.map(({ id, label, linked }) => (
        <li key={id} className="sso-links__row">
          <span className="sso-links__logo">
            <ProviderLogo provider={id} />
          </span>
          <span className="sso-links__name">
            {label}
            <span className="sso-links__state">{linked ? "Linked" : "Not linked"}</span>
          </span>
          <button
            type="button"
            className="sso-links__button"
            disabled={pending !== null}
            aria-label={`${linked ? "Disconnect" : "Connect"} ${label}`}
            onClick={() => (linked ? onDisconnect(id) : onConnect(id))}
          >
            {pending === id ? "…" : linked ? "Disconnect" : "Connect"}
          </button>
        </li>
      ))}
    </ul>
  </section>
)
