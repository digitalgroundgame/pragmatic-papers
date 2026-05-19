import { type NextRequest } from "next/server"

import { subscribeMember } from "@/utilities/listmonk"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest): Promise<Response> {
  let body: { email?: unknown }
  try {
    body = (await req.json()) as { email?: unknown }
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 })
  }

  try {
    await subscribeMember({ email })
  } catch (err) {
    // Don't leak Listmonk URLs / status codes to the client; log the detail
    // and return a friendly message. Double-opt-in means duplicate signups
    // are not an error from Listmonk's side — it just re-sends the confirm.
    console.error("[newsletter] subscribe failed", err)
    return Response.json(
      { error: "We couldn't subscribe you right now. Please try again shortly." },
      { status: 502 },
    )
  }

  return Response.json({ ok: true })
}

export const dynamic = "force-dynamic"
