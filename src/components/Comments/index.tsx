"use client"

import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import React, { useEffect, useMemo, useRef, useState } from "react"

import { ProviderSignInButton } from "@/components/ProviderSignInButton"
import { Button, buttonVariants } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { CommentThread, SignInProvider } from "@/plugins/comments"
import { useInView } from "@/hooks/useInView"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatLongDate } from "@/utilities/formatDate"
import { cn } from "@/utilities/utils"

import { CommentItem, type ReplyContext } from "./CommentItem"
import { trackCommentSort, trackSignIn } from "./analytics"
import { CommentForm, type Posted } from "./CommentForm"
import { AccountMenu } from "./AccountMenu.lazy"
import { SortMenu } from "./SortMenu.lazy"
import {
  CONTINUE_DEPTH,
  indexTree,
  parseTarget,
  pathTo,
  type ThreadNav,
  ThreadNavContext,
  useHash,
  viewRoot,
} from "./threadNav"
import { buildTree, sortRoots, visibleCount } from "./tree"
import { useCommentOrder } from "./useCommentOrder"

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

/** Marks the page a provider sends a signed-in reader back to, for the `login` event. */
const SIGNED_IN_PARAM = "signed_in"

export interface CommentsProps {
  /** The article's id. */
  articleId: number | string
  /** Payload's API route. */
  apiPath?: string
  /** The article's slug, which analytics events name it by. */
  slug?: string
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-sm">
        Sign in to join the conversation. Your first sign-in makes an account.
      </p>
      <div className="flex gap-2">
        {providers.map(({ id, label }) => (
          <ProviderSignInButton
            key={id}
            provider={id}
            label={label}
            iconOnly
            onClick={() => onSignIn(id)}
          />
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
export const Comments: React.FC<CommentsProps> = ({ articleId, apiPath = "/api", slug }) => {
  const { ref, inView } = useInView<HTMLElement>({ rootMargin: "400px" })
  const [load, setLoad] = useState<Load>({ state: "idle" })
  const [signInError, setSignInError] = useState<string | null>(null)
  const [held, setHeld] = useState<string | null>(null)
  // The top box starts as one line and opens into the form.
  const [composing, setComposing] = useState(false)
  const composerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (composing) composerRef.current?.querySelector("textarea")?.focus()
  }, [composing])
  const returnedError = useRef(false)
  const { sort, setSort, seed } = useCommentOrder()
  // Top-level comments the reader posted here, which stay at the top whatever the order.
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set())
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
        const search = new URLSearchParams(window.location.search)
        // Back from a provider that signed the reader in: count it, once, and tidy the URL.
        const provider = search.get(SIGNED_IN_PARAM)
        if (provider) {
          if (thread.viewer) trackSignIn(provider, slug)
          search.delete(SIGNED_IN_PARAM)
          const query = search.toString()
          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
          )
        }
        // Back from a provider that didn't sign the reader in: say so, once.
        const code = search.get("error")
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
  }, [inView, threadURL, reloads, slug])

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
          callbackURL: `${window.location.pathname}?${SIGNED_IN_PARAM}=${encodeURIComponent(provider)}#comments`,
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
    if (comment.parentId === null) setPinned((ids) => new Set(ids).add(String(comment.id)))
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
  const roots = useMemo(
    () => (thread ? sortRoots(buildTree(thread.comments), sort, seed, pinned) : []),
    [thread, sort, seed, pinned],
  )

  // Links into the thread: `#comment-<id>` opens, scrolls to and highlights one comment;
  // `#thread-<id>` shows one branch on its own ("Continue this thread").
  const hash = useHash()
  const target = useMemo(() => parseTarget(hash), [hash])
  const continueDepth = useIsMobile() ? CONTINUE_DEPTH.narrow : CONTINUE_DEPTH.wide
  const index = useMemo(() => indexTree(roots), [roots])
  const rootId = viewRoot(index, target, continueDepth)
  const shownRoots = rootId ? [index.get(rootId)!.node] : roots
  const path = useMemo(
    () => new Set(target?.kind === "comment" ? pathTo(index, target.id) : []),
    [index, target],
  )
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const nav: ThreadNav = useMemo(
    () => ({ continueDepth, path, highlighted }),
    [continueDepth, path, highlighted],
  )
  const linked = target && index.has(target.id) ? target : null
  useEffect(() => {
    if (!linked) return
    // After the render that opened the way to it.
    const frame = requestAnimationFrame(() => {
      const item = document.getElementById(`comment-${linked.id}`)
      if (!item) return
      item.scrollIntoView({ block: "start" })
      if (linked.kind === "comment") {
        item.querySelector<HTMLElement>("article")?.focus({ preventScroll: true })
        setHighlighted(linked.id)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [linked?.kind, linked?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- a new link, not a new object
  useEffect(() => {
    if (!highlighted) return
    const timer = setTimeout(() => setHighlighted(null), 2500)
    return () => clearTimeout(timer)
  }, [highlighted])

  const reply: ReplyContext | null = thread
    ? {
        canReply: Boolean(viewer && !viewer.locked && !viewer.needsVerifiedEmail),
        maxDepth: thread.maxDepth,
        maxLength: thread.maxLength,
        threadURL,
        onPosted: posted,
        itemId: slug,
      }
    : null

  return (
    <section
      ref={ref}
      id="comments"
      aria-labelledby="comments-heading"
      className="scroll-mt-24 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="comments-heading">
          Comments
          {count > 0 ? (
            <>
              {" "}
              {/* The heading's display face is for words; the count reads as plain text. */}
              <span className="text-muted-foreground align-middle font-sans text-xl font-normal tracking-normal tabular-nums md:text-2xl">
                ({count})
              </span>
            </>
          ) : null}
        </h2>
        {thread && thread.comments.length > 1 ? (
          <SortMenu
            value={sort}
            onChange={(next) => {
              setSort(next)
              trackCommentSort(next, slug)
            }}
          />
        ) : null}
      </div>

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
            <div className="flex items-start gap-3">
              <AccountMenu viewer={viewer} onSignOut={() => void signOut()} />
              <div className="min-w-0 flex-1 space-y-3">
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
                  <>
                    {composing ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-muted-foreground h-9 w-full justify-start rounded-full px-4 font-normal"
                        onClick={() => setComposing(true)}
                      >
                        Add a comment
                      </Button>
                    )}
                    {/* Hidden, not unmounted, when closed: a half-written comment keeps its text. */}
                    <div ref={composerRef} hidden={!composing}>
                      <CommentForm
                        threadURL={threadURL}
                        maxLength={thread.maxLength}
                        onPosted={(result) => {
                          setComposing(false)
                          posted(result)
                        }}
                        onCancel={() => setComposing(false)}
                        itemId={slug}
                        label={
                          <>
                            Commenting as <span className="font-semibold">{viewer.name}</span>
                          </>
                        }
                      />
                    </div>
                  </>
                )}
                {held ? (
                  <p role="status" className="text-sm">
                    Your comment is waiting for a moderator ({held.toLowerCase()}). Only you can see
                    it until then.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <SignIn providers={thread.providers} onSignIn={(p) => void signIn(p)} />
          )}

          {thread.truncated ? (
            <p className="text-muted-foreground text-sm">
              Showing the newest comments. Older ones aren&apos;t shown here.
            </p>
          ) : null}
          {thread.comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No comments yet.</p>
          ) : (
            <ThreadNavContext.Provider value={nav}>
              <TooltipProvider>
                {rootId ? (
                  <a
                    href="#comments"
                    className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto px-0")}
                  >
                    <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
                    Back to all comments
                  </a>
                ) : null}
                <ol className="space-y-5">
                  {shownRoots.map((node) => (
                    <CommentItem key={node.comment.id} node={node} reply={reply} />
                  ))}
                </ol>
              </TooltipProvider>
            </ThreadNavContext.Provider>
          )}
        </>
      )}
    </section>
  )
}
