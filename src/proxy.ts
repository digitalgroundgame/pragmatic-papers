import { type NextRequest, NextResponse } from "next/server"

export function proxy(request: NextRequest): ReturnType<typeof NextResponse.next> {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", request.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|monitoring).*)"],
}
