import sharp from "@/cloudflare/sharp"

/** `input` is the image's bytes, or the path of a file holding them. */
export async function blurDataUrl(input: Buffer | string): Promise<string> {
  const blurBuffer = await sharp(input)
    .resize(10, 10, { fit: "inside" })
    .blur(1)
    .png({ quality: 20 })
    .toBuffer()

  return `data:image/png;base64,${blurBuffer.toString("base64")}`
}
