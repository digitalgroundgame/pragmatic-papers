"use client"

import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { getClientSideURL } from "@/utilities/getURL"
import type { PayloadMeUser } from "@payloadcms/admin-bar"
import { PayloadAdminBar } from "@payloadcms/admin-bar"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface RouteConfig {
  plural: string
  singular: string
  // Payload collection slug — differs from the route key when the frontend
  // URL uses a different name (e.g. /authors → "users" collection).
  collectionSlug: string
}

const routes = new Map<string, RouteConfig>([
  ["pages", { collectionSlug: "pages", plural: "Pages", singular: "Page" }],
  ["volumes", { collectionSlug: "volumes", plural: "Volumes", singular: "Volume" }],
  ["articles", { collectionSlug: "articles", plural: "Articles", singular: "Article" }],
  ["authors", { collectionSlug: "users", plural: "Authors", singular: "Author" }],
  ["topics", { collectionSlug: "topics", plural: "Topics", singular: "Topic" }],
])

const collectionRouteKeys = new Set(["articles", "volumes", "authors", "topics"])

function parsePath(pathname: string): { routeKey: string; docSlug: string | undefined } {
  const [, first = "", second] = pathname.split("/")
  if (collectionRouteKeys.has(first)) {
    return { routeKey: first, docSlug: second || undefined }
  }
  return { routeKey: "pages", docSlug: first || "home" }
}

/** The ID of the `collectionSlug` document at `docSlug`, drafts included, as the logged-in user. */
async function fetchDocId(
  cmsURL: string,
  collectionSlug: string,
  docSlug: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  const query = new URLSearchParams({
    "where[slug][equals]": decodeURIComponent(docSlug),
    "select[slug]": "true",
    depth: "0",
    draft: "true",
    limit: "1",
  })
  const response = await fetch(`${cmsURL}/api/${collectionSlug}?${query}`, {
    credentials: "include",
    signal,
  })
  if (!response.ok) return undefined
  const { docs } = (await response.json()) as { docs?: { id: number | string }[] }
  return docs?.[0] ? String(docs[0].id) : undefined
}

export const AdminBarClient: React.FC<{ preview?: boolean }> = ({ preview }) => {
  const router = useRouter()
  const pathname = usePathname()
  const cmsURL = getClientSideURL()
  const [user, setUser] = useState<PayloadMeUser>()
  // Keyed by the document it was fetched for, so a stale ID never outlives a navigation.
  const [doc, setDoc] = useState<{ key: string; id: string | undefined }>()

  const { routeKey, docSlug } = parsePath(pathname)
  const routeConfig = routes.get(routeKey)
  const collectionSlug = routeConfig?.collectionSlug ?? routeKey
  const collectionLabels = routeConfig
    ? { plural: routeConfig.plural, singular: routeConfig.singular }
    : undefined

  const docKey = docSlug ? `${collectionSlug}/${docSlug}` : undefined
  const docId = doc && doc.key === docKey ? doc.id : undefined

  // Only for someone logged in: everyone else never sees the bar, so needn't pay for the lookup.
  useEffect(() => {
    if (!user || !docSlug || !docKey) return
    const controller = new AbortController()
    fetchDocId(cmsURL, collectionSlug, docSlug, controller.signal)
      .then((id) => setDoc({ key: docKey, id }))
      .catch(() => undefined)
    return () => controller.abort()
  }, [user, cmsURL, collectionSlug, docSlug, docKey])

  function onPreviewExit() {
    fetch("/next/exit-preview").then(() => {
      router.push("/")
      router.refresh()
    })
  }

  return (
    <div className={user ? "h-8 w-full bg-black text-white" : "hidden"}>
      <PayloadAdminBar
        unstyled
        className="container flex gap-1.5 px-6 py-2 text-xs"
        classNames={{
          logo: "hover:text-brand",
          user: "hidden md:inline underline-offset-2 hover:underline",
          controls: "flex ml-auto gap-1.5",
          create: "hidden md:inline underline-offset-2 hover:underline",
          edit: "hidden md:inline underline-offset-2 hover:underline",
          preview: "underline-offset-2 hover:underline",
          logout: "underline-offset-2 hover:underline",
        }}
        cmsURL={cmsURL}
        collectionSlug={collectionSlug}
        collectionLabels={collectionLabels}
        id={docId}
        logo={<PaperIcon className="size-4" />}
        onAuthChange={setUser}
        onPreviewExit={onPreviewExit}
        preview={preview}
      />
    </div>
  )
}
