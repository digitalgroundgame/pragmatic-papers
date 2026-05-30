import { isAdmin } from "@/access/checkRole"
import { seed } from "@/endpoints/seed"
import type { User } from "@/payload-types"
import configPromise from "@payload-config"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import type { PayloadRequest } from "payload"
import { getPayload } from "payload"

type SeedEvent =
  | { type: "progress"; message: string; step: number; total: number }
  | { type: "success" }
  | { type: "error"; message: string }

export async function POST(req: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seeding is not allowed in production" }, { status: 403 })
  }

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({
    req: req as unknown as PayloadRequest,
    headers: req.headers,
  })

  if (!user || !isAdmin(user as User)) {
    return NextResponse.json(
      { error: "Unauthorized. Only admins can seed the database." },
      { status: 403 },
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SeedEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
      }

      try {
        await seed(payload, (message, step, total) =>
          send({ type: "progress", message, step, total }),
        )
        send({ type: "success" })
      } catch (error) {
        console.error("Error seeding database:", error)
        const message = error instanceof Error ? error.message : "Failed to seed database"
        send({ type: "error", message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
