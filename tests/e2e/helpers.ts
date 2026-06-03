import { type Page } from "@playwright/test"

export async function gotoFirstArticle(page: Page): Promise<string | null> {
  await page.goto("/")
  const link = page.locator('a[href*="/articles/"]').first()
  const href = await link.getAttribute("href", { timeout: 5000 }).catch(() => null)
  if (!href) return null
  await page.goto(href)
  return href
}

export async function gotoFirstVolume(page: Page): Promise<string | null> {
  await page.goto("/")
  const link = page.locator('a[href*="/volumes/"]').first()
  const href = await link.getAttribute("href", { timeout: 5000 }).catch(() => null)
  if (!href) return null
  await page.goto(href)
  return href
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

export function mergeBoundingBoxes(...boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  return { x, y, width: right - x, height: bottom - y }
}

// Returns a clip region expanded from one or more bounding boxes (plus padding)
// to the viewport's aspect ratio, centered on the content.
// gridSnap rounds the clip width up to the nearest multiple of that value so
// small layout variations (e.g. flex-sized popovers) don't shift the dimensions.
export function viewportRatioClip(
  boxes: Box | Box[],
  viewport: { width: number; height: number },
  { padding = 16, gridSnap = 0 }: { padding?: number; gridSnap?: number } = {},
): Box {
  const box = Array.isArray(boxes) ? mergeBoundingBoxes(...boxes) : boxes
  const x0 = Math.round(Math.max(0, box.x - padding))
  const y0 = Math.round(Math.max(0, box.y - padding))
  const x1 = Math.round(box.x + box.width + padding)
  const y1 = Math.round(box.y + box.height + padding)
  const ratio = viewport.width / viewport.height
  let w = x1 - x0
  let h = y1 - y0
  if (w / h > ratio) {
    h = Math.round(w / ratio)
  } else {
    w = Math.round(h * ratio)
  }
  if (gridSnap > 0) {
    w = Math.ceil(w / gridSnap) * gridSnap
    h = Math.round(w / ratio)
  }
  const cx = Math.round((x0 + x1) / 2)
  const cy = Math.round((y0 + y1) / 2)
  const x = Math.max(0, Math.min(cx - Math.round(w / 2), viewport.width - w))
  const y = Math.max(0, Math.min(cy - Math.round(h / 2), viewport.height - h))
  return { x, y, width: w, height: h }
}
