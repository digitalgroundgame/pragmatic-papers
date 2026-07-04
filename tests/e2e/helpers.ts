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
import type { Page } from "@playwright/test"

/**
 * Settle sources of pixel nondeterminism before taking a screenshot: wait for
 * web fonts to finish loading (late font swaps shift every glyph) and for two
 * animation frames so in-flight layout/paint work has flushed.
 */
export async function waitForStableRender(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export function mergeBoundingBoxes(...boxes: BoundingBox[]): BoundingBox {
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
  boxes: BoundingBox | BoundingBox[],
  viewport: { width: number; height: number },
  { padding = 16, gridSnap = 0 }: { padding?: number; gridSnap?: number } = {},
): BoundingBox {
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

const NAMED_RATIOS = {
  square: 1,
  photo: 4 / 3,
  classic: 3 / 2,
  video: 16 / 9,
  vertical: 9 / 16,
} as const

type NamedRatio = keyof typeof NAMED_RATIOS

export class Screenshot {
  private box: BoundingBox | null

  constructor(box: BoundingBox | null) {
    this.box = box
  }

  padding(amount: number): Screenshot {
    if (!this.box) return this
    return new Screenshot({
      x: Math.max(0, this.box.x - amount),
      y: Math.max(0, this.box.y - amount),
      width: this.box.width + amount * 2,
      height: this.box.height + amount * 2,
    })
  }

  aspectRatio(ratio: number | NamedRatio): Screenshot {
    if (!this.box) return this
    const resolved = typeof ratio === "string" ? NAMED_RATIOS[ratio] : ratio
    const { x, y, width, height } = this.box
    const current = width / height
    if (current > resolved) {
      const newHeight = width / resolved
      const delta = (newHeight - height) / 2
      const newY = Math.max(0, y - delta)
      const actualDelta = y - newY
      return new Screenshot({ x, y: newY, width, height: height + actualDelta * 2 })
    } else {
      const newWidth = height * resolved
      const delta = (newWidth - width) / 2
      const newX = Math.max(0, x - delta)
      const actualDelta = x - newX
      return new Screenshot({ x: newX, y, width: width + actualDelta * 2, height })
    }
  }

  get clip(): BoundingBox | undefined {
    return this.box ?? undefined
  }
}
