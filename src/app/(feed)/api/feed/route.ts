import { type NextRequest, NextResponse } from "next/server"
import { getFeedBatch } from "../../feed/getFeedBatch"

export async function GET(request: NextRequest): Promise<Response> {
  const cursorParam = request.nextUrl.searchParams.get("cursor")
  const limitParam = request.nextUrl.searchParams.get("limit")
  const seedParam = request.nextUrl.searchParams.get("seed")

  const cursor = cursorParam ? Math.max(1, parseInt(cursorParam, 10) || 1) : 1
  const limit = limitParam ? Math.min(20, Math.max(1, parseInt(limitParam, 10) || 8)) : 8
  const seed = seedParam ? parseInt(seedParam, 10) : undefined

  const batch = await getFeedBatch({ cursor, limit, seed })
  return NextResponse.json(batch, {
    headers: { "Cache-Control": "no-store" },
  })
}

export const dynamic = "force-dynamic"
