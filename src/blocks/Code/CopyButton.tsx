"use client"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { useState } from "react"

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function CopyButton({ code }: { code: string }) {
  const [text, setText] = useState("Copy")

  function updateCopyStatus() {
    if (text === "Copy") {
      setText(() => "Copied!")
      setTimeout(() => {
        setText(() => "Copy")
      }, 1000)
    }
  }

  return (
    <Button
      className="flex gap-1 justify-self-end"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code)
        } catch {
          // clipboard unavailable in some environments (headless, sandboxed iframes)
          return
        }
        updateCopyStatus()
      }}
    >
      <span>{text}</span>
      <Copy className="size-4" />
    </Button>
  )
}
