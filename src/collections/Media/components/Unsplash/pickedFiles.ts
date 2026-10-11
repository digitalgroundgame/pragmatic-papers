/**
 * The files the Unsplash picker handed to the upload form, by photo id, so the hidden
 * `unsplashId` field can tell when the file it describes has been swapped for another.
 * Size and lastModified survive the upload form renaming a file; a different file almost
 * never matches both.
 */
const picked = new Map<string, { size: number; lastModified: number }>()

export function rememberPickedFile(photoId: string, file: File): void {
  picked.set(photoId, { size: file.size, lastModified: file.lastModified })
}

export function isPickedFile(photoId: string, file: File): boolean {
  const seen = picked.get(photoId)
  return seen != null && seen.size === file.size && seen.lastModified === file.lastModified
}
