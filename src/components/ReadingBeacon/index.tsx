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
 * Tells the site a signed-in reader visited today, and, on an article, that they read it. Pages
 * are one cached copy for everyone, so this is the browser's job. It does nothing unless the
 * sign-in cookie is there: readers who aren't signed in send nothing at all. A 401 means the
 * session ended, so it drops the cookie and stops asking.
 */
export const ReadingBeacon: React.FC<ReadingBeaconProps> = ({
  articleId,
  apiPath = "/api",
  signedInCookie = DEFAULT_SIGNED_IN_COOKIE,
}) => {
  const end = useRef<HTMLSpanElement>(null)

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
