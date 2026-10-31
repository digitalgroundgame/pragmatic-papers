/** A comment as a reader typed it, tidied for storing, or why it can't be posted. */
export type CommentBody = { ok: true; body: string } | { ok: false; message: string }

/**
 * Trims a comment, drops control characters other than line breaks and tabs, and keeps at
 * most one blank line between paragraphs. Comments are plain text: they render as text, never
 * HTML, so nothing else needs escaping here.
 */
export function normalizeCommentBody(raw: unknown, maxLength: number): CommentBody {
  if (typeof raw !== "string") return { ok: false, message: "Write a comment first." }

  const body = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (!body) return { ok: false, message: "Write a comment first." }
  if (body.length > maxLength) {
    return { ok: false, message: `Comments can be at most ${maxLength} characters.` }
  }
  return { ok: true, body }
}
