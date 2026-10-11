import { env, type Integration } from "../types"

export interface OAuthCredentials {
  clientId: string
  clientSecret: string
}

export interface OAuthAppIntegration extends Integration {
  /** The application's client ID and secret, or null while either is unset. */
  credentials(): OAuthCredentials | null
}

export interface OAuthAppOptions {
  id: string
  label: string
  /** The identity provider: "Google", "Discord". */
  service: string
  clientIdEnv: string
  clientSecretEnv: string
}

/**
 * An OAuth application registered with an identity provider, which people sign in to this
 * site through. The provider redirects back to `<SERVER_URL>/api/auth/callback/<provider>`,
 * which has to be listed among the application's redirect URIs.
 */
export function oauthApp({
  id,
  label,
  service,
  clientIdEnv,
  clientSecretEnv,
}: OAuthAppOptions): OAuthAppIntegration {
  return {
    id,
    label,
    service,
    describe: () => `${service.toLowerCase()}:oauth`,
    required: [clientIdEnv, clientSecretEnv],
    credentials() {
      const clientId = env(clientIdEnv)
      const clientSecret = env(clientSecretEnv)
      return clientId && clientSecret ? { clientId, clientSecret } : null
    },
  }
}
