"use client"

import React, { useEffect, useRef, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useInView } from "@/hooks/useInView"
import type { CommentThread, PublicComment, ReaderProviderId } from "@/plugins/comments"
// The constants alone: the plugin's index brings in its schema, which is server code.
import { PROVIDER_LABELS } from "@/plugins/comments/constants"
import { formatLongDate, formatTimeAgo } from "@/utilities/formatDate"
import { getInitials } from "@/utilities/getInitials"

/** What Better Auth puts in `?error=` when a sign-in comes back without a session. */
const SIGN_IN_ERRORS: Record<string, string> = {
  email_not_found: "That provider didn't share an email address, so we can't sign you in with it.",
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

const ReaderAvatar: React.FC<{ name: string; image: string | null }> = ({ name, image }) => (
  <Avatar size="md" aria-hidden="true">
    {image ? <AvatarImage src={image} alt="" referrerPolicy="no-referrer" /> : null}
    <AvatarFallback>{getInitials(name)}</AvatarFallback>
  </Avatar>
)

const CommentList: React.FC<{ comments: PublicComment[] }> = ({ comments }) =>
  comments.length === 0 ? (
    <p className="text-muted-foreground text-sm">No comments yet.</p>
  ) : (
    <ol className="space-y-5">
      {comments.map((comment) => (
        <li key={comment.id} className="flex gap-3">
          <ReaderAvatar name={comment.author.name} image={comment.author.image} />
          <div className="min-w-0 space-y-1">
            <p className="text-sm">
              <span className="font-semibold">{comment.author.name}</span>{" "}
              <time
                dateTime={comment.createdAt}
                title={formatLongDate(comment.createdAt)}
                className="text-muted-foreground"
              >
                {formatTimeAgo(comment.createdAt)}
              </time>
            </p>
            <p className="text-base break-words whitespace-pre-line">{comment.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )

const SignIn: React.FC<{
  providers: ReaderProviderId[]
  onSignIn: (provider: ReaderProviderId) => void
}> = ({ providers, onSignIn }) =>
  providers.length === 0 ? (
    <p className="text-muted-foreground text-sm">Commenting isn&apos;t open yet.</p>
  ) : (
    <div className="space-y-3">
      <p className="text-sm">Sign in to join the conversation.</p>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <Button key={provider} variant="outline" onClick={() => onSignIn(provider)}>
            Sign in with {PROVIDER_LABELS[provider]}
          </Button>
        ))}
      </div>
    </div>
  )

const CommentForm: React.FC<{
  thread: CommentThread
  threadURL: string
  onPosted: (comment: PublicComment) => void
  onSignOut: () => void
}> = ({ thread, threadURL, onPosted, onSignOut }) => {
  const viewer = thread.viewer!
  const [body, setBody] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (viewer.banned) {
    return (
      <p className="text-muted-foreground text-sm">
        A moderator has stopped this account from commenting.
      </p>
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPosting(true)
    setError(null)
    try {
      const response = await fetch(threadURL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      const result = (await response.json()) as { comment?: PublicComment; message?: string }
      if (!response.ok || !result.comment) {
        setError(result.message ?? "Your comment didn't post. Try again.")
        return
      }
      onPosted(result.comment)
      setBody("")
    } catch {
      setError("Your comment didn't post. Try again.")
    } finally {
      setPosting(false)
    }
  }

  return (
    <form className="space-y-2" onSubmit={(event) => void submit(event)}>
      <label htmlFor="comment-body" className="flex items-center gap-2 text-sm">
        <ReaderAvatar name={viewer.name} image={viewer.image} />
        <span>
          Commenting as <span className="font-semibold">{viewer.name}</span>
        </span>
      </label>
      <Textarea
        id="comment-body"
        value={body}
        maxLength={thread.maxLength}
        required
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "comment-error" : undefined}
        onChange={(event) => setBody(event.target.value)}
      />
      {error ? (
        <p id="comment-error" role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="link" className="h-auto p-0" onClick={onSignOut}>
          Sign out
        </Button>
        <Button type="submit" disabled={posting || !body.trim()}>
          {posting ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </form>
  )
}

/**
 * An article's comments, loaded once the reader scrolls near them, so the page itself stays
 * one cached copy for everyone and readers who never get this far cost nothing.
 */
export const Comments: React.FC<CommentsProps> = ({ articleId, apiPath = "/api" }) => {
  const { ref, inView } = useInView<HTMLElement>({ rootMargin: "400px" })
  const [load, setLoad] = useState<Load>({ state: "idle" })
  const [signInError, setSignInError] = useState<string | null>(null)
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

  const signIn = async (provider: ReaderProviderId) => {
    setSignInError(null)
    try {
      const response = await fetch(`${apiPath}/reader-auth/sign-in/social`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
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
    await fetch(`${apiPath}/reader-auth/sign-out`, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined)
    reload()
  }

  const added = (comment: PublicComment) =>
    setLoad((current) =>
      current.state === "ready"
        ? {
            state: "ready",
            thread: { ...current.thread, comments: [...current.thread.comments, comment] },
          }
        : current,
    )

  return (
    <section
      ref={ref}
      id="comments"
      aria-labelledby="comments-heading"
      className="scroll-mt-24 space-y-6"
    >
      <h2 id="comments-heading" className="font-display text-2xl">
        Comments
        {load.state === "ready" && load.thread.comments.length > 0 ? (
          <>
            {" "}
            <span className="text-muted-foreground">({load.thread.comments.length})</span>
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
      ) : load.state !== "ready" ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Loading comments…
        </p>
      ) : (
        <>
          <CommentList comments={load.thread.comments} />
          {load.thread.viewer ? (
            <CommentForm
              thread={load.thread}
              threadURL={threadURL}
              onPosted={added}
              onSignOut={() => void signOut()}
            />
          ) : (
            <SignIn providers={load.thread.providers} onSignIn={(p) => void signIn(p)} />
          )}
        </>
      )}
    </section>
  )
}
