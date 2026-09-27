"use client"

import { Button, FieldLabel, toast, useFormFields } from "@payloadcms/ui"
import React from "react"
import { getClientSideURL } from "@/utilities/getURL"

/**
 * Shows the single-article feed URL an editor pastes into Substack's importer
 * (Settings → Import) to bring this article over as a post.
 */
export const SubstackImportUrl: React.FC = () => {
  const slug = useFormFields(([fields]) => fields.slug?.value as string | undefined)

  if (!slug) return null

  const url = `${getClientSideURL()}/feed.substack/${encodeURIComponent(slug)}`

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Substack import URL copied")
    } catch {
      toast.error("Could not copy — select the URL and copy it by hand")
    }
  }

  return (
    <div className="field-type" style={{ marginBottom: "1.5rem" }}>
      <FieldLabel label="Substack import URL" />
      <code style={{ display: "block", wordBreak: "break-all", marginBottom: "0.5rem" }}>
        {url}
      </code>
      <Button buttonStyle="secondary" size="small" margin={false} onClick={copy}>
        Copy URL
      </Button>
      <p className="field-description">
        In Substack, open Settings → Import and paste this URL. It serves the article once it is
        published.
      </p>
    </div>
  )
}
