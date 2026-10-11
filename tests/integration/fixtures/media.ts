import { randomUUID } from "node:crypto"

// this file generates a very tiny green square png.
export const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)

/**
 * A tiny PNG to upload. Named uniquely by default: every test file has its own database but
 * they all share public/media, and Payload only checks its own database for a taken name, so
 * two files uploading "test.png" at once would overwrite and delete each other's file.
 */
export function testFile(name = `test-${randomUUID()}.png`): {
  name: string
  data: Buffer
  mimetype: "image/png"
  size: number
} {
  return {
    name,
    data: MINIMAL_PNG,
    mimetype: "image/png" as const,
    size: MINIMAL_PNG.length,
  }
}
