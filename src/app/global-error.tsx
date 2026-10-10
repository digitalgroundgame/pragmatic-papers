"use client"

import { captureException } from "@/sentryClient"
import NextError from "next/error"
import { useEffect } from "react"

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}): React.ReactElement {
  useEffect(() => {
    // Unhandled: this page replaced the whole layout. Reported before the admin's console
    // capture (sentryClient.ts `reportConsoleErrors`), which sees the same error.
    captureException(error, {
      mechanism: { handled: false, type: "auto.function.nextjs.global_error" },
    })
  }, [error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
