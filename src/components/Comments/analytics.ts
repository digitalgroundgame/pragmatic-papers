import { sendGAEvent } from "@next/third-parties/google"

/**
 * Google Analytics events for the comments. Counts come from our database; these only say how
 * commenting fits into a visit. They never carry what anyone wrote, who they are, or an ID
 * that identifies the reader: `item_id` is the article's slug, as `share` uses.
 */

/** A comment or reply posted (held by a check or not). */
export function trackComment(
  itemId: string | undefined,
  { isReply, held }: { isReply: boolean; held: boolean },
): void {
  sendGAEvent("event", "comment", {
    content_type: "article",
    item_id: itemId ?? null,
    is_reply: isReply,
    held,
  })
}

/**
 * A reader back from a provider with a session, after signing in from the comment box. GA's
 * own `login` event; the site can't tell a first sign-in (a new account) from a later one here.
 */
export function trackSignIn(method: string, itemId: string | undefined): void {
  sendGAEvent("event", "login", { method, content_type: "comment", item_id: itemId ?? null })
}

/** The reader picked another order for the comments. */
export function trackCommentSort(sort: string, itemId: string | undefined): void {
  sendGAEvent("event", "comment_sort", { sort, item_id: itemId ?? null })
}

/** A comment's link copied with its Share button. */
export function trackCommentShare(itemId: string | undefined): void {
  sendGAEvent("event", "share", {
    method: "copy_link",
    content_type: "comment",
    item_id: itemId ?? null,
  })
}
