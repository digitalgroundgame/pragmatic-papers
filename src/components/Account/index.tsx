"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import React, { Suspense, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AccountSummary } from "@/plugins/sso/endpoints/account"

import { LinkedSignIns } from "./LinkedSignIns"

export interface AccountProps {
  /** The providers someone signed out can sign in (or make an account) with. */
  providers: Array<{ id: string; label: string }>
  /** Payload's API route. */
  apiPath?: string
}

type Load =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "signed-out" }
  | { state: "ready"; account: AccountSummary }

const SIGN_IN_FAILED = "Sign-in didn't complete. Try again."

/** Sign-in buttons for someone signed out. A first sign-in makes a member account. */
const SignIn: React.FC<{ providers: AccountProps["providers"]; apiPath: string }> = ({
  providers,
  apiPath,
}) => {
  const [error, setError] = useState<string | null>(null)
  const signIn = async (provider: string) => {
    setError(null)
    try {
      const response = await fetch(`${apiPath}/auth/sign-in/social`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          requestSignUp: true,
          callbackURL: "/account",
          errorCallbackURL: "/account",
        }),
      })
      const { url } = (await response.json()) as { url?: string }
      if (!response.ok || !url) throw new Error("no redirect")
      window.location.assign(url)
    } catch {
      setError(SIGN_IN_FAILED)
    }
  }
  return (
    <section className="space-y-3">
      <p>You&apos;re not signed in.</p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {providers.map(({ id, label }) => (
          <Button key={id} variant="outline" onClick={() => void signIn(id)}>
            Sign in with {label}
          </Button>
        ))}
      </div>
    </section>
  )
}

const NameForm: React.FC<{
  name: string
  url: string
  onSaved: (account: AccountSummary) => void
}> = ({ name: saved, url, onSaved }) => {
  const [name, setName] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(url, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const result = (await response.json()) as Partial<AccountSummary> & { message?: string }
      if (!response.ok) {
        setMessage({ error: true, text: result.message ?? "Your name didn't save. Try again." })
        return
      }
      onSaved(result as AccountSummary)
      setName(result.name ?? name)
      setMessage({ error: false, text: "Saved." })
    } catch {
      setMessage({ error: true, text: "Your name didn't save. Try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-2" onSubmit={(event) => void save(event)}>
      <Label htmlFor="account-name">Display name</Label>
      <p id="account-name-hint" className="text-muted-foreground text-sm">
        Shown beside your comments.
      </p>
      <div className="flex gap-2">
        <Input
          id="account-name"
          value={name}
          required
          maxLength={60}
          aria-describedby="account-name-hint"
          aria-invalid={message?.error ? true : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" disabled={saving || !name.trim() || name.trim() === saved}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {message ? (
        <p
          role={message.error ? "alert" : "status"}
          className={message.error ? "text-destructive text-sm" : "text-muted-foreground text-sm"}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  )
}

const DeleteAccount: React.FC<{ url: string }> = ({ url }) => {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch(url, { method: "DELETE", credentials: "same-origin" })
      if (!response.ok) throw new Error(String(response.status))
      router.push("/")
    } catch {
      setError("Your account wasn't deleted. Try again.")
      setDeleting(false)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading" className="text-lg font-semibold">
        Delete your account
      </h2>
      <p className="text-muted-foreground text-sm">
        Your account, your sign-ins and the words of your comments are deleted for good. Replies
        other people wrote to you stay, under a note that the comment was removed.
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <div className="flex gap-2">
          <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>
            {deleting ? "Deleting…" : "Yes, delete my account"}
          </Button>
          <Button variant="ghost" disabled={deleting} onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      )}
    </section>
  )
}

/**
 * The account page's content: who is signed in, read from `/api/account` (never cached, so
 * the page around it can be), with their name, sign-ins, sign out and, for members, delete.
 */
export const Account: React.FC<AccountProps> = ({ providers, apiPath = "/api" }) => {
  const [load, setLoad] = useState<Load>({ state: "loading" })
  const url = `${apiPath}/account`

  useEffect(() => {
    let cancelled = false
    fetch(url, { credentials: "same-origin" })
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 401) return setLoad({ state: "signed-out" })
        if (!response.ok) throw new Error(String(response.status))
        setLoad({ state: "ready", account: (await response.json()) as AccountSummary })
      })
      .catch(() => {
        if (!cancelled) setLoad({ state: "failed" })
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const signOut = async () => {
    await fetch(`${apiPath}/auth/sign-out`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined)
    setLoad({ state: "signed-out" })
  }

  if (load.state === "loading") {
    return (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Loading your account…
      </p>
    )
  }
  if (load.state === "failed") {
    return <p className="text-muted-foreground text-sm">Your account couldn&apos;t load.</p>
  }
  if (load.state === "signed-out") return <SignIn providers={providers} apiPath={apiPath} />

  const { account } = load
  return (
    <div className="space-y-10">
      <p className="text-sm">
        Signed in as <span className="font-semibold">{account.name}</span>
        {account.email ? (
          <span className="text-muted-foreground"> ({account.email})</span>
        ) : null}.{" "}
        <Button variant="link" className="h-auto p-0" onClick={() => void signOut()}>
          Sign out
        </Button>
      </p>
      {account.managedInAdmin ? (
        <p className="text-sm">
          Staff accounts are managed in the admin:{" "}
          <Link href="/admin/account" className="underline underline-offset-4">
            open your account there
          </Link>
          .
        </p>
      ) : (
        <>
          {account.email ? null : (
            <p className="text-sm" role="status">
              Your account has no email address yet. Connect Google or Discord below to add the one
              they&apos;ve verified.
            </p>
          )}
          <NameForm
            name={account.name}
            url={url}
            onSaved={(saved) => setLoad({ state: "ready", account: saved })}
          />
          {/* It reads the link callback's `?error=`, which a static page only has in the browser. */}
          <Suspense fallback={null}>
            <LinkedSignIns apiPath={apiPath} />
          </Suspense>
          <DeleteAccount url={url} />
        </>
      )}
    </div>
  )
}
