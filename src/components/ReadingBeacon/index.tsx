"use client"

import React, { useEffect, useRef } from "react"

import { READING_PATH } from "@/plugins/achievements/reading/constants"
import { localDay } from "@/plugins/achievements/reading/days"
import { DEFAULT_SIGNED_IN_COOKIE } from "@/plugins/sso/constants"

/** How long a reader has to stay on an article, visible, for it to count as read. */
export const READ_AFTER_MS = 2 * 60 * 1000

/** The day this browser last reported a visit, so it reports one a day. */
const VISIT_KEY = "pp-visit-day"

export interface ReadingBeaconProps {
  /** On an article: report it read once the reader reaches its end or stays a while. */
  articleId?: number
  /** Payload's API route. */
  apiPath?: string
  /** The cookie sign-in sets for the page to read. */
  signedInCookie?: string
}

const signedIn = (cookie: string): boolean =>
  document.cookie.split(";").some((pair) => pair.trim().startsWith(`${cookie}=`))

function storedDay(): string | null {
  try {
    return localStorage.getItem(VISIT_KEY)
  } catch {
    return null
  }
}

function storeDay(day: string): void {
  try {
    localStorage.setItem(VISIT_KEY, day)
  } catch {
    // Storage blocked: the server ignores a second visit on the same day anyway.
  }
}

/**
 * Counts one view of an article in the site's own view count, for every reader: one request
 * to our own API, with no cookie and nothing about the reader. Ad blockers stop the trackers
 * they know, like Google Analytics, but not a site's own endpoints, so this counts readers GA
 * can't. `sendBeacon` survives the reader leaving at once and never holds the page up.
 */
function sendView(apiPath: string, articleId: number): void {
  const url = `${apiPath}/articles/${articleId}/view`
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url)) return
  // A count that doesn't arrive isn't worth troubling the reader about.
  void fetch(url, { method: "POST", keepalive: true, credentials: "omit" }).catch(() => null)
}

/**
 * The site's one reading tracker. On an article it counts the view for everyone (`sendView`).
 * For a signed-in reader it also tells the site they visited today, and, on an article, that
 * they read it. Pages are one cached copy for everyone, so this is the browser's job. Readers
 * who aren't signed in send the view and nothing else, with no cookie. A 401 means the session
 * ended, so it drops the sign-in cookie and stops asking.
 */
export const ReadingBeacon: React.FC<ReadingBeaconProps> = ({
  articleId,
  apiPath = "/api",
  signedInCookie = DEFAULT_SIGNED_IN_COOKIE,
}) => {
  const end = useRef<HTMLSpanElement>(null)
  const viewed = useRef<number | null>(null)

  useEffect(() => {
    if (articleId === undefined || viewed.current === articleId) return
    viewed.current = articleId
    sendView(apiPath, articleId)
  }, [articleId, apiPath])

  useEffect(() => {
    if (!signedIn(signedInCookie)) return

    const send = (body: { article?: number }): void => {
      const day = localDay()
      fetch(`${apiPath}${READING_PATH}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, ...body }),
        keepalive: true,
      })
        .then((response) => {
          if (response.status === 401) {
            document.cookie = `${signedInCookie}=; Path=/; Max-Age=0; SameSite=Lax`
          }
        })
        .catch(() => undefined)
      storeDay(day)
    }

    if (articleId === undefined) {
      if (storedDay() !== localDay()) send({})
      return
    }

    let done = false
    let stop = (): void => undefined
    const read = (): void => {
      if (done) return
      done = true
      stop()
      send({ article: articleId })
    }

    // Reaching the end of the article counts.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) read()
          })
    if (observer && end.current) observer.observe(end.current)

    // So does staying on it: two minutes while the tab is in view.
    let shown = document.visibilityState === "visible" ? Date.now() : null
    let spent = 0
    const tick = window.setInterval(() => {
      if (shown !== null && spent + (Date.now() - shown) >= READ_AFTER_MS) read()
    }, 5000)
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") shown ??= Date.now()
      else if (shown !== null) {
        spent += Date.now() - shown
        shown = null
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    stop = () => {
      observer?.disconnect()
      window.clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisibility)
    }
    return () => stop()
  }, [articleId, apiPath, signedInCookie])

  // Out of the flow, so the article's spacing doesn't change, but still where the text ends.
  return articleId === undefined ? null : (
    <span ref={end} aria-hidden="true" className="pointer-events-none absolute h-px w-px" />
  )
}
