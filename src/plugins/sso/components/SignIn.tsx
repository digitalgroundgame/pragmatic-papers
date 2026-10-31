import type { Payload } from "payload"
import React from "react"

import { configuredProviders } from "../auth"
import { AUTH_ENDPOINT_PATH } from "../constants"
import type { ResolvedSsoConfig } from "../types"
import { SignInButtons } from "./SignInButtons"

/**
 * The provider buttons above the admin's login form. Renders nothing while single sign-on
 * is switched off or no provider has credentials, so the form looks as it always has.
 */
export async function SignIn({
  payload,
  sso,
}: {
  payload: Payload
  sso: ResolvedSsoConfig
}): Promise<React.ReactElement | null> {
  if (!(await sso.enabled({ payload }))) return null
  const providers = configuredProviders(sso)
  if (providers.length === 0) return null

  const { routes } = payload.config
  return (
    <SignInButtons
      providers={providers}
      authPath={`${routes.api}${AUTH_ENDPOINT_PATH}`}
      adminPath={routes.admin}
    />
  )
}
