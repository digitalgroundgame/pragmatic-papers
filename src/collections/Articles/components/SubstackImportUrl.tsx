"use client"

import { Button, FieldLabel, toast, useFormFields } from "@payloadcms/ui"
import React from "react"
import { isSubstackUrl } from "@/collections/Articles/substackUrl"
import { getClientURL } from "@/utilities/getURL"

/**
 * Shows the single-article feed URL an editor pastes into Substack's importer
 * (Settings → Import) to bring this article over as a post, or, once the article's
 * Substack post URL is filled in, that it's imported and a link to the post.
 */
export const SubstackImportUrl: React.FC = () => {
  const slug = useFormFields(([fields]) => fields.slug?.value as string | undefined)
  const substackUrl = useFormFields(
    ([fields]) => fields.substackUrl?.value as string | null | undefined,
  )
  const imported = substackUrl?.trim()

  // Imported: say so, with the post, rather than the URL to import it from.
  if (imported && isSubstackUrl(imported)) {
    return (
      <div className="field-type" style={{ marginBottom: "1.5rem" }}>
        <FieldLabel label="Substack" />
        <p style={{ margin: 0 }}>
          Imported →{" "}
          <a href={imported} target="_blank" rel="noopener noreferrer">
            View the post on Substack
          </a>
        </p>
      </div>
    )
  }

  if (!slug) return null

  const url = `${getClientURL()}/articles/${encodeURIComponent(slug)}/substack.xml`

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
