"use client"

// Imported from the package root, not "@payloadcms/ui/fields/Relationship": the
// root is pre-bundled with its own copy of the admin's React contexts, so a deep
// import resolves to a second module instance whose `useConfig` reads a context
// no provider ever filled, and throws on first render.
import { RelationshipField } from "@payloadcms/ui"
import type { RelationshipFieldClientProps } from "payload"
import React from "react"

import { useIsAudioUpload } from "./useIsAudioUpload"

export const NarratorField: React.FC<RelationshipFieldClientProps> = (props) => {
  const isAudioUpload = useIsAudioUpload()

  if (!isAudioUpload) return null

  return <RelationshipField {...props} />
}
