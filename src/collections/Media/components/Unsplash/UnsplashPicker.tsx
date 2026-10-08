"use client"

import {
  Button,
  Drawer,
  useDrawerSlug,
  useForm,
  useFormFields,
  useModal,
  useUploadControls,
} from "@payloadcms/ui"
import React, { useCallback } from "react"

import type { UnsplashPhoto } from "@/integrations/unsplash"

import { rememberPickedFile } from "./pickedFiles"
import { UnsplashSearch, type SearchUnsplash, type UnsplashResults } from "./UnsplashSearch"

async function errorOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? `${fallback} (HTTP ${res.status}).`
}

const searchUnsplash: SearchUnsplash = async (query, page, orientation) => {
  const params = new URLSearchParams({ query, page: String(page) })
  if (orientation) params.set("orientation", orientation)
  const res = await fetch(`/api/media/unsplash/search?${params}`, { credentials: "include" })
  if (!res.ok) throw new Error(await errorOf(res, "Searching Unsplash failed"))
  return (await res.json()) as UnsplashResults
}

/**
 * "Search Unsplash", beside "Select a file" and "Paste URL" wherever a Media upload is made,
 * the "Create New" drawer of an upload field included. A picked photo becomes the form's file
 * like any other upload, so it's stored wherever Media is (local disk or S3) and gets every
 * image size. The photo's id rides along in `unsplashId` so the save can credit it.
 */
export function UnsplashPicker(): React.ReactNode {
  const slug = useDrawerSlug("unsplash")
  const { openModal, closeModal } = useModal()
  const { setUploadControlFile } = useUploadControls()
  const { dispatchFields } = useForm()
  const alt = useFormFields(([fields]) => fields.alt?.value)

  const pick = useCallback(
    async (photo: UnsplashPhoto): Promise<void> => {
      const res = await fetch(`/api/media/unsplash/${encodeURIComponent(photo.id)}/file`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(await errorOf(res, "Downloading the photo failed"))
      const blob = await res.blob()
      const file = new File([blob], `unsplash-${photo.photographer.username}-${photo.id}.jpg`, {
        type: blob.type || "image/jpeg",
      })

      rememberPickedFile(photo.id, file)
      dispatchFields({ type: "UPDATE", path: "unsplashId", value: photo.id })
      if (photo.alt && !(typeof alt === "string" && alt.trim())) {
        dispatchFields({ type: "UPDATE", path: "alt", value: photo.alt })
      }
      closeModal(slug)
      setUploadControlFile(file)
    },
    [alt, closeModal, dispatchFields, setUploadControlFile, slug],
  )

  return (
    <>
      <Button buttonStyle="pill" onClick={() => openModal(slug)} size="small">
        Search Unsplash
      </Button>
      <Drawer slug={slug} title="Unsplash">
        <UnsplashSearch onPick={pick} search={searchUnsplash} />
      </Drawer>
    </>
  )
}
