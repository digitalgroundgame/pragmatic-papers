"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { NewsletterSignupBlock as Props } from "@/payload-types"

type Status = "idle" | "submitting" | "success" | "error"

export const NewsletterSignupBlock: React.FC<Props> = ({ heading, description, buttonLabel }) => {
  const [email, setEmail] = React.useState("")
  const [status, setStatus] = React.useState<Status>("idle")
  const [message, setMessage] = React.useState<string | null>(null)
  const disabled = status === "submitting" || status === "success"

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (status === "submitting") return
    setStatus("submitting")
    setMessage(null)
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatus("error")
        setMessage(body.error ?? "Something went wrong. Please try again.")
        return
      }
      setStatus("success")
      setMessage("Check your inbox to confirm your subscription.")
      setEmail("")
    } catch {
      setStatus("error")
      setMessage("Network error. Please try again.")
    }
  }

  return (
    <section className="bg-card text-card-foreground container my-8 rounded-lg border p-6">
      {heading ? <h3 className="m-0 text-xl font-semibold">{heading}</h3> : null}
      {description ? <p className="text-muted-foreground mt-2 text-sm">{description}</p> : null}
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
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
          disabled={disabled}
        />
        <Button type="submit" disabled={disabled}>
          {status === "submitting" ? "Subscribing…" : (buttonLabel ?? "Subscribe")}
        </Button>
      </form>
      {message ? (
        <p
          className={`mt-3 text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
