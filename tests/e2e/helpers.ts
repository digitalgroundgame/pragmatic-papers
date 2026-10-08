import { expect, type Locator, type Page } from "@playwright/test"

import { SEEDED_DATELINE, SEEDED_REVISION } from "../../scripts/seed-e2e.constants"

/**
 * Assert that an article hero's two instants read the words the seed pinned.
 *
 * Payload stamps `updatedAt` with the current time on every non-draft save, so
 * without the seed's pin the revision line tracks the day the seed ran. A stamp
 * that goes back to following the clock fails here, naming the cause.
 */
export async function expectPinnedDateline(page: Page): Promise<void> {
  const stamps = page.locator("#article-dateline").locator("time")
  await expect(stamps).toHaveCount(2)
  await expect(stamps.nth(0)).toHaveText(SEEDED_DATELINE)
  await expect(stamps.nth(1)).toHaveText(SEEDED_REVISION)
}

/**
 * Messages a page may log as errors without failing a smoke test. A failed
 * network fetch (a third-party script the test sandbox can't reach, an image
 * the seed never uploaded) is logged by the browser as
 * "Failed to load resource" — it is not a JavaScript error in our code.
 */
const ALLOWED_CONSOLE_ERRORS: RegExp[] = [/^Failed to load resource\b/]

/**
 * Collect every console error and uncaught exception a page produces from now
 * on. Call the returned function to read them; assert it is empty once the
 * page has done its work.
 */
export function trackPageErrors(page: Page): () => string[] {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text()
    if (ALLOWED_CONSOLE_ERRORS.some((pattern) => pattern.test(text))) return
    errors.push(`console.error: ${text}`)
  })
  page.on("pageerror", (error) => {
    errors.push(`uncaught: ${error.message}`)
  })
  return () => [...errors]
}

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

/**
 * Settle the page before measuring layout: wait for web fonts to finish
 * loading (late font swaps shift every glyph), for all <img>s in the DOM to
 * finish decoding (a still-loading hero image changes the height of what sits
 * below it), for every finite CSS animation/transition currently running to
 * finish, and for two animation frames so any remaining layout/paint work has
 * flushed.
 *
 * Infinite animations (loading skeletons) are intentionally excluded —
 * waiting on one would hang forever.
 */
export async function waitForStableRender(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? img.decode().catch(() => undefined)
          : new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true })
              img.addEventListener("error", resolve, { once: true })
            }),
      ),
    )
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    )
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Poll an element's bounding box until it stops changing across several
 * consecutive animation frames, then return the settled box. Use this before
 * asserting on the geometry of an element whose position can shift late in
 * layout — e.g. a control sitting below a hero image that resolves its
 * intrinsic height a frame or two after decode.
 */
export async function waitForStableBox(
  locator: Locator,
  { frames = 5, maxTicks = 300 }: { frames?: number; maxTicks?: number } = {},
): Promise<BoundingBox> {
  const page = locator.page()
  let last: BoundingBox | null = null
  let stable = 0
  for (let tick = 0; tick < maxTicks; tick++) {
    const box = await locator.boundingBox()
    if (
      box &&
      last &&
      box.x === last.x &&
      box.y === last.y &&
      box.width === last.width &&
      box.height === last.height
    ) {
      if (++stable >= frames) return box
    } else {
      stable = 0
    }
    last = box
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))))
  }
  if (!last) throw new Error("Element never produced a bounding box")
  return last
}
