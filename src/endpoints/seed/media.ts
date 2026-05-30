import type { Payload, File } from "payload"
import type { Media } from "@/payload-types"

/**
 * Fetches a file from a URL and returns a File object compatible with Payload
 */
export async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: "include",
    method: "GET",
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }

  const data = await res.arrayBuffer()
  const extension = url.split(".").pop()?.toLowerCase() || ""

  // Map file extensions to proper MIME types
  const mimeTypeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    flac: "audio/flac",
  }

  const baseName = url.split("/").pop() || `file-${Date.now()}`
  // Prefix with a run-specific timestamp so repeated seed runs never trigger
  // Payload's filename-increment logic, which hits a Drizzle buildQuery bug.
  const name = `${Date.now()}-${baseName}`

  return {
    name,
    data: Buffer.from(data),
    mimetype: mimeTypeMap[extension] || `image/${extension}`,
    size: data.byteLength,
  }
}

/**
 * Creates a media document in Payload from a URL.
 *
 * Retries up to `maxAttempts` times on Drizzle internal errors (e.g.
 * `Symbol(drizzle:Columns)` or `_uuid` undefined), which can occur when
 * Next.js hot-reloads the adapter mid-run or when the DB is in a partially
 * cleaned state. On the final attempt, `additionalData` (e.g. caption) is
 * stripped to maximise the chance of success.
 *
 * @param payload - Payload instance
 * @param url - URL of the file to fetch
 * @param alt - Alt text for the media
 * @param additionalData - Optional additional data to include (e.g., caption)
 * @returns The created media document
 */
export async function createMediaFromURL(
  payload: Payload,
  url: string,
  alt: string,
  additionalData?: Partial<Omit<Media, "id" | "alt">>,
): Promise<Media> {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // On the last attempt, strip optional data so only core fields remain
    const isLastAttempt = attempt === maxAttempts
    const useAdditionalData = additionalData && !isLastAttempt

    try {
      // Re-fetch the file on each attempt so the filename timestamp is fresh,
      // which avoids Payload's filename-conflict increment path on retries.
      const file = await fetchFileByURL(url)
      return await payload.create({
        collection: "media",
        data: { alt, ...(useAdditionalData ? additionalData : {}) },
        file,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (attempt < maxAttempts) {
        payload.logger.warn(
          `Media upload attempt ${attempt}/${maxAttempts} failed for "${alt}", retrying. Error: ${message}`,
        )
        // Brief pause to let the adapter settle after a hot-reload reset
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      } else {
        throw err
      }
    }
  }

  // Unreachable — TypeScript requires explicit return/throw after the loop
  throw new Error(`Failed to upload media "${alt}" after ${maxAttempts} attempts`)
}
