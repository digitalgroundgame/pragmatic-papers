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

interface Box { x: number; y: number; width: number; height: number }

// Returns a clip region that tightly frames two bounding boxes (plus padding)
// then expands to the viewport's aspect ratio, centered on the content.
export function viewportRatioClip(
  a: Box,
  b: Box,
  viewport: { width: number; height: number },
  padding = 16,
): Box {
  const x0 = Math.round(Math.max(0, Math.min(a.x, b.x) - padding))
  const y0 = Math.round(Math.max(0, Math.min(a.y, b.y) - padding))
  const x1 = Math.round(Math.max(a.x + a.width, b.x + b.width) + padding)
  const y1 = Math.round(Math.max(a.y + a.height, b.y + b.height) + padding)
  const ratio = viewport.width / viewport.height
  let w = x1 - x0
  let h = y1 - y0
  if (w / h > ratio) {
    h = Math.round(w / ratio)
  } else {
    w = Math.round(h * ratio)
  }
  const cx = Math.round((x0 + x1) / 2)
  const cy = Math.round((y0 + y1) / 2)
  const x = Math.max(0, Math.min(cx - Math.round(w / 2), viewport.width - w))
  const y = Math.max(0, Math.min(cy - Math.round(h / 2), viewport.height - h))
  return { x, y, width: w, height: h }
}
