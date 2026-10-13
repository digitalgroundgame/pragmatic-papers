import { notFound } from "next/navigation"
import type { Metadata } from "next"
import React from "react"

import { Account } from "@/components/Account"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { signUpProviders } from "@/plugins/signIn"

export const metadata: Metadata = {
  title: "Your account — Pragmatic Papers",
  robots: { index: false },
}

/**
 * The signed-in reader's account. The page is the same for everyone, so it caches like any
 * other; `Account` reads who is signed in from `/api/account` once it loads.
 */
export default async function AccountPage(): Promise<React.ReactNode> {
  if (!(await isExperimentEnabled("sso"))) notFound()

  return (
    <article className="mx-auto max-w-xl space-y-8 px-4 pb-16">
      <header className="space-y-2">
        <h1>Your account</h1>
        <p className="text-muted-foreground text-sm">
          The name you comment under, the accounts you sign in with, and deleting your account.
        </p>
      </header>
      <Account providers={signUpProviders()} />
    </article>
  )
}
