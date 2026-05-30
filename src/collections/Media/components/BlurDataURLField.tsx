"use client"
import { Button, FieldLabel, TextInput, useDocumentInfo, useField } from "@payloadcms/ui"
import type { TextFieldClientProps } from "payload"
import React, { useEffect, useRef, useState } from "react"

import { RefreshCcwIcon } from "lucide-react"
import type { RegenerateBlurResponse } from "../types"

export const BlurDataURLField: React.FC<TextFieldClientProps> = ({ field, path }) => {
  const { label } = field
  const fieldPath = path || field.name
  const { value, setValue } = useField<string>({ path: fieldPath })
  const { id } = useDocumentInfo()
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const handleRegenerate = () => {
    if (!id || isLoading) return

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/media/${id}/regenerate-blur`, { method: "POST" })
        if (response.ok) {
          const { blurDataURL } = (await response.json()) as RegenerateBlurResponse
          setValue(blurDataURL)
        }
      } finally {
        setIsLoading(false)
      }
    }, 500)
  }

  return (
    <div>
      <FieldLabel htmlFor={`field-${fieldPath}`} label={label} />
      <div style={{ alignItems: "center", display: "flex", gap: "8px" }}>
        <div style={{ flex: 1 }}>
          <TextInput onChange={setValue} path={fieldPath} readOnly value={value ?? ""} />
        </div>
        <Button
          buttonStyle="subtle"
          disabled={!id || isLoading}
          onClick={handleRegenerate}
          size="large"
        >
          <RefreshCcwIcon style={{ width: "16px", height: "16px", marginRight: "4px" }} />
          <span style={{ width: "140px" }}>{isLoading ? "Loading..." : "Regenerate"}</span>
        </Button>
      </div>
    </div>
  )
}
