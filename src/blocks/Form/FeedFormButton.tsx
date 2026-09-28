"use client"

import { useFeedAutoPlay } from "@/app/(feed)/feed/hooks/useFeedAutoPlay"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import React, { useEffect, useState } from "react"

interface FeedFormButtonProps {
  triggerLabel: string
  /** The server-rendered form (see `FeedFormBlock`). */
  children: React.ReactNode
}

export const FeedFormButton: React.FC<FeedFormButtonProps> = ({ triggerLabel, children }) => {
  const [open, setOpen] = useState(false)
  const { pauseAutoPlay, resumeAutoPlay } = useFeedAutoPlay()

  // Pause the auto-play timer while the form dialog is open so the
  // progress bar doesn't tick past while the reader is filling it out.
  useEffect(() => {
    if (!open) return
    pauseAutoPlay()
    return () => resumeAutoPlay()
  }, [open, pauseAutoPlay, resumeAutoPlay])

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
          {children}
        </DialogContent>
      </Dialog>
    </div>
  )
}
