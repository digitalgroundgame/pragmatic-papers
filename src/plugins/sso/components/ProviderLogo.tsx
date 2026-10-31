import React from "react"

import type { SsoProviderId } from "../types"

/** Google's four-color "G", as its sign-in branding guidelines ask for. */
const GoogleLogo: React.FC = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
)

/** Discord's Clyde mark, in the button's text color. */
const DiscordLogo: React.FC = () => (
  <svg viewBox="0 0 127.14 96.36" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69z"
    />
  </svg>
)

/** Destiny.gg's icon, unmodified (`assets/web/img/dgg-icon.svg` in destiny/website). */
const DestinyLogo: React.FC = () => (
  <svg viewBox="0 0 265 265" aria-hidden="true" focusable="false">
    <polygon
      fill="#59aeea"
      points="163.97 243.98 244.55 243.98 244.55 193.3 212.04 193.3 163.97 243.98"
    />
    <polygon
      fill="#59aeea"
      points="244.55 74.87 244.55 24.2 163.97 24.2 212.04 74.87 244.55 74.87"
    />
    <path
      fill="#1A1A1A"
      d="m0,0l0,264.65185l264.64799,0l0,-264.43211l-264.64799,-0.21974zm244.55112,243.97671l-80.58024,0l48.07751,-50.67974l32.50659,0l0,50.67974l-0.00386,0zm0,-169.10208l-32.50658,0l-48.07751,-50.67974l80.58024,0l0,50.67974l0.00385,0z"
    />
    <path
      fill="#FFFFFF"
      d="m22.09769,28.18882l0,211.97129l116.22877,0l49.35742,-51.89025l0,-109.49383l-49.33044,-50.58721l-116.25575,0zm68.77964,29.63064l17.36358,0l0,148.85101l-17.36358,0l0,-148.85101z"
    />
  </svg>
)

const LOGOS: Record<SsoProviderId, React.FC> = {
  google: GoogleLogo,
  discord: DiscordLogo,
  destiny: DestinyLogo,
}

export const ProviderLogo: React.FC<{ provider: SsoProviderId }> = ({ provider }) => {
  const Logo = LOGOS[provider]
  return <Logo />
}
