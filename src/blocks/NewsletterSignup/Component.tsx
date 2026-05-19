"use client"

import * as React from "react"

import type { NewsletterSignupBlock as Props } from "@/payload-types"

type Status = "idle" | "submitting" | "success" | "error"

export const NewsletterSignupBlock: React.FC<Props> = ({ heading, description, buttonLabel }) => {
  const [email, setEmail] = React.useState("")
  const [status, setStatus] = React.useState<Status>("idle")
  const [message, setMessage] = React.useState<string | null>(null)

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
    <section className="container my-8 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
      {heading ? <h3 className="m-0 text-xl font-semibold">{heading}</h3> : null}
      {description ? <p className="mt-2 text-sm text-neutral-700">{description}</p> : null}
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
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
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          disabled={status === "submitting" || status === "success"}
        />
        <button
          type="submit"
          disabled={status === "submitting" || status === "success"}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === "submitting" ? "Subscribing…" : (buttonLabel ?? "Subscribe")}
        </button>
      </form>
      {message ? (
        <p
          className={`mt-3 text-sm ${status === "error" ? "text-red-600" : "text-neutral-700"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
