"use client"

import React, { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { PublicComment } from "@/plugins/comments"

export interface Posted {
  comment: PublicComment
  /** Why a check held it back, when one did. */
  held?: string
}

/** A box to write a comment, or a reply to one (`parentId`). */
export const CommentForm: React.FC<{
  threadURL: string
  maxLength: number
  parentId?: number | string
  label: React.ReactNode
  onPosted: (posted: Posted) => void
  onCancel?: () => void
  /** Focus the box when it appears (a reply box, or the top box once a reader opens it). */
  autoFocus?: boolean
}> = ({ threadURL, maxLength, parentId, label, onPosted, onCancel, autoFocus }) => {
  const id = useId()
  const [body, setBody] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPosting(true)
    setError(null)
    try {
      const response = await fetch(threadURL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, ...(parentId !== undefined && { parentId }) }),
      })
      const result = (await response.json()) as Partial<Posted> & { message?: string }
      if (!response.ok || !result.comment) {
        setError(result.message ?? "Your comment didn't post. Try again.")
        return
      }
      onPosted({ comment: result.comment, held: result.held })
      setBody("")
    } catch {
      setError("Your comment didn't post. Try again.")
    } finally {
      setPosting(false)
    }
  }

  const errorId = `${id}-error`
  const countId = `${id}-count`
  // Counted only near the limit, where it helps; before that it's noise. With a long limit,
  // the last 500 characters are near enough.
  const left = maxLength - body.length
  const nearLimit = left <= Math.min(500, Math.ceil(maxLength / 10))
  const describedBy = [error && errorId, nearLimit && countId].filter(Boolean).join(" ")
  return (
    <form className="space-y-2" onSubmit={(event) => void submit(event)}>
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <Textarea
        id={id}
        value={body}
        maxLength={maxLength}
        required
        rows={parentId === undefined ? 3 : 2}
        autoFocus={autoFocus ?? parentId !== undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => setBody(event.target.value)}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {nearLimit ? (
          <p id={countId} aria-live="polite" className="text-muted-foreground mr-auto text-xs">
            {left === 1 ? "1 character left" : `${left} characters left`}
          </p>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={posting || !body.trim()}>
          {posting ? "Posting…" : parentId === undefined ? "Post comment" : "Post reply"}
        </Button>
      </div>
    </form>
  )
}
