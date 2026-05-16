"use client"
import dynamic from "next/dynamic"

// Loaded only when actually rendered (i.e. draft mode). Keeps
// @payloadcms/live-preview-react out of every route's main bundle.
export const LivePreviewListener = dynamic(
  () => import("./Inner").then((m) => m.LivePreviewListenerInner),
  { ssr: false },
)
