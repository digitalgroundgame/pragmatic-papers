import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    commit: process.env.DEPLOY_COMMIT_SHA || "unknown",
    environment: process.env.NODE_ENV,
  })
}
