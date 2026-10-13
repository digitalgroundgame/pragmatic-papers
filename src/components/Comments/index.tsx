"use client"

import Link from "next/link"
import React, { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { CommentThread, SignInProvider } from "@/plugins/comments"
import { useInView } from "@/hooks/useInView"
import { formatLongDate } from "@/utilities/formatDate"

import { AuthorAvatar, CommentItem, type ReplyContext } from "./CommentItem"
import { CommentForm, type Posted } from "./CommentForm"
import { buildTree, visibleCount } from "./tree"

/** What Better Auth puts in `?error=` when a sign-in comes back without a session. */
const SIGN_IN_ERRORS: Record<string, string> = {
  email_not_found: "That provider didn't share an email address, so we can't sign you in with it.",
  signup_disabled: "New accounts can't be made right now.",
  unable_to_create_user:
    "We couldn't make an account with that sign-in. The provider needs to have verified your email address.",
  account_not_linked:
    "That address already signed in with another provider, which this one couldn't confirm. Use the one you signed in with before.",
}
const SIGN_IN_FAILED = "Sign-in didn't complete. Try again."

export interface CommentsProps {
  /** The article's id. */
  articleId: number | string
  /** Payload's API route. */
  apiPath?: string
}

type Load =
  { state: "idle" | "loading" } | { state: "failed" } | { state: "ready"; thread: CommentThread }

const SignIn: React.FC<{
  providers: SignInProvider[]
  onSignIn: (provider: string) => void
}> = ({ providers, onSignIn }) =>
  providers.length === 0 ? (
    <p className="text-muted-foreground text-sm">Commenting isn&apos;t open yet.</p>
  ) : (
    <div className="space-y-3">
      <p className="text-sm">
        Sign in to join the conversation. Your first sign-in makes an account.
      </p>
      <div className="flex flex-wrap gap-2">
        {providers.map(({ id, label }) => (
          <Button key={id} variant="outline" onClick={() => onSignIn(id)}>
            Sign in with {label}
          </Button>
        ))}
      </div>
    </div>
  )

const Locked: React.FC<{ until: string | null }> = ({ until }) => (
  <p className="text-muted-foreground text-sm" role="status">
    {until
      ? `Too many of your comments were held or hidden recently, so you can't comment until ${formatLongDate(until)}.`
      : "A moderator has stopped this account from commenting."}
  </p>
)

/**
 * An article's comments, loaded once the reader scrolls near them, so the page itself stays
 * one cached copy for everyone and readers who never get this far cost nothing.
 */
export const Comments: React.FC<CommentsProps> = ({ articleId, apiPath = "/api" }) => {
  const { ref, inView } = useInView<HTMLElement>({ rootMargin: "400px" })
  const [load, setLoad] = useState<Load>({ state: "idle" })
  const [signInError, setSignInError] = useState<string | null>(null)
  const [held, setHeld] = useState<string | null>(null)
  const returnedError = useRef(false)
  const threadURL = `${apiPath}/comments/thread/${articleId}`

  // Bumped to load the thread again: after signing out, or to retry.
  const [reloads, setReloads] = useState(0)
  const reload = () => {
    setLoad({ state: "loading" })
    setReloads((n) => n + 1)
  }

  useEffect(() => {
    if (!inView) return
    let cancelled = false
    fetch(threadURL, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<CommentThread>
      })
      .then((thread) => {
        if (cancelled) return
        setLoad({ state: "ready", thread })
        // Back from a provider that didn't sign the reader in: say so, once.
        const code = new URLSearchParams(window.location.search).get("error")
        if (code && !returnedError.current) {
          returnedError.current = true
          setSignInError(SIGN_IN_ERRORS[code] ?? SIGN_IN_FAILED)
        }
      })
      .catch(() => {
        if (!cancelled) setLoad({ state: "failed" })
      })
    return () => {
      cancelled = true
    }
  }, [inView, threadURL, reloads])

  const signIn = async (provider: string) => {
    setSignInError(null)
    try {
      const response = await fetch(`${apiPath}/auth/sign-in/social`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          // Someone new gets a member account; without this, only an existing one signs in.
          requestSignUp: true,
          callbackURL: `${window.location.pathname}#comments`,
          errorCallbackURL: window.location.pathname,
        }),
      })
      const { url } = (await response.json()) as { url?: string }
      if (!response.ok || !url) throw new Error("no redirect")
      window.location.assign(url)
    } catch {
      setSignInError(SIGN_IN_FAILED)
    }
  }

  const signOut = async () => {
    await fetch(`${apiPath}/auth/sign-out`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined)
    reload()
  }

  const posted = ({ comment, held: reason }: Posted) => {
    setHeld(reason ?? null)
    setLoad((current) =>
      current.state === "ready"
        ? {
            state: "ready",
            thread: { ...current.thread, comments: [...current.thread.comments, comment] },
          }
        : current,
    )
  }

  const thread = load.state === "ready" ? load.thread : null
  const count = thread ? visibleCount(thread.comments) : 0
  const viewer = thread?.viewer ?? null
  const reply: ReplyContext | null = thread
    ? {
        canReply: Boolean(viewer && !viewer.locked && !viewer.needsVerifiedEmail),
        maxDepth: thread.maxDepth,
        maxLength: thread.maxLength,
        threadURL,
        onPosted: posted,
      }
    : null

  return (
    <section
      ref={ref}
      id="comments"
      aria-labelledby="comments-heading"
      className="scroll-mt-24 space-y-6"
    >
      <h2 id="comments-heading" className="font-display text-2xl">
        Comments
        {count > 0 ? (
          <>
            {" "}
            <span className="text-muted-foreground">({count})</span>
          </>
        ) : null}
      </h2>

      {signInError ? (
        <p role="alert" className="text-destructive text-sm">
          {signInError}
        </p>
      ) : null}

      {load.state === "failed" ? (
        <p className="text-muted-foreground text-sm">
          Comments couldn&apos;t load.{" "}
          <Button variant="link" className="h-auto p-0" onClick={reload}>
            Try again
          </Button>
        </p>
      ) : !thread || !reply ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Loading comments…
        </p>
      ) : (
        <>
          {viewer ? (
            <div className="space-y-3">
              {viewer.locked ? (
                <Locked until={viewer.locked.until} />
              ) : viewer.needsVerifiedEmail ? (
                <p className="text-muted-foreground text-sm" role="status">
                  Commenting here needs a verified email address. Connect Google or Discord, which
                  verify yours, from{" "}
                  <Link href="/account" className="underline underline-offset-4">
                    your account
                  </Link>
                  .
                </p>
              ) : (
                <CommentForm
                  threadURL={threadURL}
                  maxLength={thread.maxLength}
                  onPosted={posted}
                  label={
                    <span className="flex items-center gap-2">
                      <AuthorAvatar author={viewer} />
                      <span>
                        Commenting as <span className="font-semibold">{viewer.name}</span>
                      </span>
                    </span>
                  }
                />
              )}
              {held ? (
                <p role="status" className="text-sm">
                  Your comment is waiting for a moderator ({held.toLowerCase()}). Only you can see
                  it until then.
                </p>
              ) : null}
              <p className="text-muted-foreground flex gap-4 text-sm">
                <Link href="/account" className="underline underline-offset-4">
                  Your account
                </Link>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => void signOut()}
                >
                  Sign out
                </Button>
              </p>
            </div>
          ) : (
            <SignIn providers={thread.providers} onSignIn={(p) => void signIn(p)} />
          )}

          {thread.comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No comments yet.</p>
          ) : (
            <ol className="space-y-6">
              {buildTree(thread.comments).map((node) => (
                <CommentItem key={node.comment.id} node={node} reply={reply} />
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
