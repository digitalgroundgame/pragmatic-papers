"use client"
import { getClientSideURL } from "@/utilities/getURL"
import { RefreshRouteOnSave as PayloadLivePreview } from "@payloadcms/live-preview-react"
import { useRouter } from "next/navigation"
import React from "react"

export const LivePreviewListenerInner: React.FC = () => {
  const router = useRouter()
  return <PayloadLivePreview refresh={router.refresh} serverURL={getClientSideURL()} />
}
