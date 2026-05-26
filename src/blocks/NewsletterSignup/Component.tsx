"use client"

import Script from "next/script"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { NewsletterSignupBlock as Props } from "@/payload-types"

// Payload `defaultValue` only fills in DB rows when an editor creates the
// block. When the component is used directly in code (e.g. the Footer),
// props are undefined — so we duplicate the defaults here as runtime
// fallbacks.
const DEFAULT_HEADING = "Subscribe to Pragmatic Papers"
const DEFAULT_DESCRIPTION =
  "Get one article each weekday during a Volume drop. No spam, unsubscribe any time."
const DEFAULT_BUTTON_LABEL = "Subscribe"

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  "error-callback"?: () => void
  "expired-callback"?: () => void
  theme?: "light" | "dark" | "auto"
  size?: "normal" | "flexible" | "compact"
}

interface TurnstileApi {
  render: (el: HTMLElement, opts: TurnstileRenderOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

type Status = "idle" | "submitting" | "success" | "error"

export const NewsletterSignupBlock: React.FC<Props> = ({ heading, description, buttonLabel }) => {
  const [email, setEmail] = React.useState("")
  const [status, setStatus] = React.useState<Status>("idle")
  const [message, setMessage] = React.useState<string | null>(null)
  const [token, setToken] = React.useState<string | null>(null)
  const [scriptReady, setScriptReady] = React.useState(false)
  const widgetContainerRef = React.useRef<HTMLDivElement>(null)
  const widgetIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!scriptReady || !TURNSTILE_SITE_KEY) return
    const container = widgetContainerRef.current
    const turnstile = window.turnstile
    if (!container || !turnstile || widgetIdRef.current) return
    widgetIdRef.current = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "auto",
      callback: (t) => setToken(t),
      "expired-callback": () => setToken(null),
      "error-callback": () => setToken(null),
    })
    return () => {
      const id = widgetIdRef.current
      if (id && window.turnstile) window.turnstile.remove(id)
      widgetIdRef.current = null
    }
  }, [scriptReady])

  const headingText = heading ?? DEFAULT_HEADING
  const descriptionText = description ?? DEFAULT_DESCRIPTION
  const buttonText = buttonLabel ?? DEFAULT_BUTTON_LABEL
  const disabled = status === "submitting" || status === "success" || !token

  const resetWidget = (): void => {
    const id = widgetIdRef.current
    if (id && window.turnstile) window.turnstile.reset(id)
    setToken(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (status === "submitting" || !token) return
    setStatus("submitting")
    setMessage(null)
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatus("error")
        setMessage(body.error ?? "Something went wrong. Please try again.")
        resetWidget()
        return
      }
      setStatus("success")
      setMessage("Check your inbox to confirm your subscription.")
      setEmail("")
    } catch {
      setStatus("error")
      setMessage("Network error. Please try again.")
      resetWidget()
    }
  }

  return (
    <section className="bg-muted text-foreground my-10 rounded-xl border p-8 md:p-12">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div className="mx-auto max-w-xl text-center">
        <h3 className="m-0 text-2xl font-bold tracking-tight md:text-3xl">{headingText}</h3>
        <p className="text-muted-foreground mx-auto mt-3 text-base">{descriptionText}</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <Input
            id="newsletter-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={254}
            className="flex-1"
            disabled={status === "submitting" || status === "success"}
          />
          <Button type="submit" disabled={disabled}>
            {status === "submitting" ? "Subscribing…" : buttonText}
          </Button>
        </form>
        <div ref={widgetContainerRef} className="mt-3 flex justify-center" />
        {message ? (
          <p
            className={`mt-3 text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
            role={status === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
