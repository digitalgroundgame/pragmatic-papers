import type { Media } from "@/payload-types"

/**
 * The tallest shape the article hero takes: an image taller than 16:9 (a portrait or a
 * square) is cropped to it, around its focal point, so the title stays near the top of the
 * screen.
 */
export const TALLEST_HERO = 16 / 9

/**
 * The widest shape the article hero takes: a banner wider than 4:1 is cropped to it, so the
 * hero never shrinks to a strip.
 */
export const WIDEST_HERO = 4

/**
 * The aspect ratio (width / height) the article hero shows `media` at: its own, between
 * {@link TALLEST_HERO} and {@link WIDEST_HERO}, so any image in that range is shown whole.
 * An image stored without dimensions gets 16:9. (A video hero ignores this: `VideoMedia`
 * takes no `style`, so it plays in its own shape.)
 */
export function heroAspectRatio(media: Media | number | null | undefined): number {
  if (typeof media !== "object" || !media?.width || !media.height) return TALLEST_HERO
  return Math.min(Math.max(media.width / media.height, TALLEST_HERO), WIDEST_HERO)
}
