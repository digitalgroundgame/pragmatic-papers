"use client"

import { useFeedAutoPlay } from "@/app/(feed)/feed/hooks/useFeedAutoPlay"
import type { LexicalNode } from "@/app/(feed)/feed/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Form } from "@/payload-types"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React, { useEffect, useState } from "react"
import { FormBlockClient } from "./FormBlockClient"

interface FeedFormButtonProps {
  node: LexicalNode
}

interface FormBlockFields {
  form?: Form | number | null
  enableIntro?: boolean | null
  introContent?: DefaultTypedEditorState | null
}

export const FeedFormButton: React.FC<FeedFormButtonProps> = ({ node }) => {
  const fields = (node.fields as FormBlockFields | undefined) ?? {}
  const { form, enableIntro, introContent } = fields
  const [open, setOpen] = useState(false)
  const { pauseAutoPlay, resumeAutoPlay } = useFeedAutoPlay()

  // Pause the auto-play timer while the form dialog is open so the
  // progress bar doesn't tick past while the reader is filling it out.
  useEffect(() => {
    if (!open) return
    pauseAutoPlay()
    return () => resumeAutoPlay()
  }, [open, pauseAutoPlay, resumeAutoPlay])

  if (!form || typeof form === "number") {
    return null
  }

  const triggerLabel = form.title || form.submitButtonLabel || "Open form"

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-3xl text-white">{triggerLabel}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="default" size="lg">
              Open form
            </Button>
          }
        />
        <DialogContent className="max-h-[90dvh] w-[min(640px,calc(100vw-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{triggerLabel}</DialogTitle>
          </DialogHeader>
          <FormBlockClient
            form={form}
            enableIntro={enableIntro}
            introContent={introContent ?? null}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
