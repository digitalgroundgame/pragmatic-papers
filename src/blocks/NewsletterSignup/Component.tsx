"use client"

import Script from "next/script"
import * as React from "react"

import { RichText as ConvertRichText, LinkJSXConverter } from "@payloadcms/richtext-lexical/react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { NewsletterSignupBlock as NewsletterSignupTypes } from "@/payload-types"

// Payload `defaultValue` only fills in DB rows when an editor creates the
// block. When the component is used directly in code (e.g. the Footer),
// props are undefined — so we duplicate the defaults here as runtime
// fallbacks.
const DEFAULT_HEADING = "Get Daily Pragmatic Papers"
const DEFAULT_BUTTON_LABEL = "Sign Up"

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

export const NewsletterSignupBlock: React.FC<NewsletterSignupTypes> = ({
  heading,
  description,
  buttonLabel,
  notice,
  id: blockId,
}) => {
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
  const buttonText = buttonLabel ?? DEFAULT_BUTTON_LABEL
  const disabled =
    status === "submitting" || status === "success" || (!!TURNSTILE_SITE_KEY && !token)

  const resetWidget = (): void => {
    const id = widgetIdRef.current
    if (id && window.turnstile) window.turnstile.reset(id)
    setToken(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (status === "submitting" || (TURNSTILE_SITE_KEY && !token)) return
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

  const currentId = blockId || "newsletter-email"

  return (
    <div className="space-y-3 font-sans">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <h3 className="mt-0!">{headingText}</h3>
      {description && <p className="font-serif">{description}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field className="flex-1">
          <FieldLabel htmlFor={currentId}>Email address</FieldLabel>
          <Input
            id={currentId}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={254}
            disabled={status === "submitting" || status === "success"}
          />
        </Field>
        <Button type="submit" disabled={disabled}>
          {status === "submitting" ? "Subscribing…" : buttonText}
        </Button>
      </form>
      {status === "error" && message ? (
        <FieldError className="mt-3">{message}</FieldError>
      ) : status === "success" && message ? (
        <FieldDescription className="mt-3">{message}</FieldDescription>
      ) : null}
      {notice && (
        <ConvertRichText
          className="text-muted-foreground [&_a:hover]:text-primary text-sm [&_a]:underline [&_a]:underline-offset-4"
          converters={({ defaultConverters }) => ({
            ...defaultConverters,
            ...LinkJSXConverter({
              internalDocToHref: ({ linkNode }) => linkNode.fields.url ?? "#",
            }),
          })}
          data={notice}
        />
      )}
      <div ref={widgetContainerRef} className="mt-3 flex justify-center" />
    </div>
  )
}
