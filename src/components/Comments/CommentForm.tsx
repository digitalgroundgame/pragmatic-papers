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
}> = ({ threadURL, maxLength, parentId, label, onPosted, onCancel }) => {
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
        autoFocus={parentId !== undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setBody(event.target.value)}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
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
