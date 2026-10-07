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
    captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
