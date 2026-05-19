export const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)

export function testFile(name = "test.png"): {
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
