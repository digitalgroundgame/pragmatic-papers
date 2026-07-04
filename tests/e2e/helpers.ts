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
