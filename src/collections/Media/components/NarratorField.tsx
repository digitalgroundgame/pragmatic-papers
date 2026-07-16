"use client"

import { RelationshipField } from "@payloadcms/ui/fields/Relationship"
import type { RelationshipFieldClientProps } from "payload"
import React from "react"

import { useIsAudioUpload } from "./useIsAudioUpload"

export const NarratorField: React.FC<RelationshipFieldClientProps> = (props) => {
  const isAudioUpload = useIsAudioUpload()

  if (!isAudioUpload) return null

  return <RelationshipField {...props} />
}
