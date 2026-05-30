import sharp from "sharp"

export async function getBlurDataUrlFromBuffer(buffer: Buffer): Promise<string> {
  const blurBuffer = await sharp(buffer)
    .resize(10, 10, { fit: "inside" })
    .blur(1)
    .png({ quality: 20 })
    .toBuffer()

  return `data:image/png;base64,${blurBuffer.toString("base64")}`
}
