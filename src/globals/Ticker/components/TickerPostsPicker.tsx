"use client"

import { useForm, useFormFields } from "@payloadcms/ui"

import { postKey, type TickerPost } from "@/components/Ticker/items"

import { TickerPostsTable } from "./TickerPostsTable"

/** The array field the picker adds to and removes from. */
const HIDDEN = "hidden"

/**
 * The posts table, wired to the Hidden posts array in the form: Hide adds the post's link as a
 * row and Show removes its row, so the change is saved with the rest of the global.
 */
export function TickerPostsPicker({ lists }: { lists: TickerPost[][] }): React.ReactNode {
  const { addFieldRow, removeFieldRow, disabled } = useForm()
  // Joined, so the table re-renders only when a link changes, not on every keystroke elsewhere.
  const joined = useFormFields(([fields]) => {
    const rows = fields[HIDDEN]?.rows?.length ?? 0
    return Array.from({ length: rows }, (_, i) => fields[`${HIDDEN}.${i}.url`]?.value ?? "").join(
      "\n",
    )
  })
  const hidden = joined ? joined.split("\n") : []

  const onToggle = (post: TickerPost, hide: boolean): void => {
    if (hide) {
      addFieldRow({
        path: HIDDEN,
        schemaPath: HIDDEN,
        rowIndex: hidden.length,
        subFieldState: { url: { initialValue: post.url, value: post.url, valid: true } },
      })
      return
    }
    const key = postKey(post.url)
    // Every row that names this post, last first so the indexes stay right.
    for (let i = hidden.length - 1; i >= 0; i--) {
      if (postKey(hidden[i]!) === key) removeFieldRow({ path: HIDDEN, rowIndex: i })
    }
  }

  return <TickerPostsTable lists={lists} hidden={hidden} onToggle={onToggle} disabled={disabled} />
}
