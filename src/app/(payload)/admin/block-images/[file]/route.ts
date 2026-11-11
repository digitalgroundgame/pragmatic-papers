import { renderBlockImages } from "@/blocks/blockImages/render"

// The block picker's images: each block's `admin.images` (`blockImages(slug)`) points here,
// and its `picker.tsx` draws them. Under /admin so it's served wherever the admin is: the
// Worker sends /admin to the origin. Prerendered at build, one response per file.
export const dynamic = "force-static"
export const dynamicParams = false

const FILES = renderBlockImages()

export async function generateStaticParams(): Promise<{ file: string }[]> {
  return Object.keys(await FILES).map((file) => ({ file }))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const svg = (await FILES)[(await params).file]
  if (svg === undefined) return new Response(null, { status: 404 })
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } })
}
