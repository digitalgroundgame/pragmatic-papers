import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"
import { createArticle } from "../articles"
import { createMediaFromURL } from "../media"
import {
  createLinkNode,
  createParagraph,
  createRichText,
  createRichTextFromString,
  createTextNode,
} from "../richtext"

/**
 * Helper to create a media block
 */
function createMediaBlock(mediaId: number) {
  return {
    type: "block",
    fields: {
      blockType: "mediaBlock",
      media: mediaId,
    },
    format: "",
    version: 2,
  }
}

/**
 * Helper to create a media collage block
 */
function createMediaCollageBlock(mediaIds: number[], layout: "grid" | "carousel" = "grid") {
  return {
    type: "block",
    fields: {
      blockType: "mediaCollage",
      layout,
      images: mediaIds.map((id) => ({
        media: id,
      })),
    },
    format: "",
    version: 2,
  }
}

// Deliberately long caption to verify that the caption scrolls independently
// without affecting the image area (tests overflow-y-auto on captionClassName).
const LONG_CAPTION =
  "This is a deliberately long caption to test the scrollable caption area in the lightbox. " +
  "When a caption exceeds approximately four lines of text it should begin scrolling within its own " +
  "container, leaving the image completely undisturbed above it. " +
  "You are reading line three now — the scroll threshold should be approaching. " +
  "Here is the fifth line, which should be hidden behind the scroll boundary and only visible " +
  "after scrolling down within the caption area itself."

export const createMediaCollageArticle = async (
  payload: Payload,
  writer: User,
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  // Create media with captions
  const [itsBadMedia, blueCoatMedia, wideMedia, portraitMedia, longCaptionMedia] =
    await Promise.all([
      createMediaFromURL(
        payload,
        "https://wikicdn.destiny.gg/f/fd/ITSBAD.png",
        "It's bad, what do you want me to say!",
        {
          caption: createRichText([
            createParagraph([
              createTextNode("It's bad, what do you want me to say! "),
              createLinkNode("Learn more", "https://destiny.gg", true),
            ]),
          ]),
        },
      ),
      createMediaFromURL(
        payload,
        "https://wikicdn.destiny.gg/6/64/BlueCoat.jpg",
        "A snazzy blue jacket",
        {
          caption: createRichTextFromString("A snazzy blue jacket"),
        },
      ),
      // Wide landscape (≈5:1) — tests max-w-[90vw] constraint (horizontal overflow fix)
      createMediaFromURL(
        payload,
        "https://picsum.photos/seed/pp-wide/1920/400.jpg",
        "A wide panoramic landscape",
        {
          caption: createRichTextFromString(
            "Wide landscape: should never overflow the viewport horizontally.",
          ),
        },
      ),
      // Tall portrait (≈4:9) — tests max-h-[80dvh] constraint (vertical overflow fix)
      createMediaFromURL(
        payload,
        "https://picsum.photos/seed/pp-portrait/400/900.jpg",
        "A tall portrait image",
        {
          caption: createRichTextFromString(
            "Tall portrait: should fit within the viewport height.",
          ),
        },
      ),
      // Long caption — tests overflow-y-auto scrolling on the caption area
      createMediaFromURL(
        payload,
        "https://picsum.photos/seed/pp-caption/800/600.jpg",
        "An image with a very long caption",
        {
          caption: createRichTextFromString(LONG_CAPTION),
        },
      ),
    ])

  // Build the article content programmatically
  const content = createRichText([
    // Short caption baseline
    createParagraph("Click on any image to open the lightbox. Captions are shown below the image."),
    createMediaBlock(itsBadMedia.id),
    // Wide landscape — horizontal overflow regression test
    createParagraph("Wide landscape image — the lightbox should constrain width to 90vw."),
    createMediaBlock(wideMedia.id),
    // Tall portrait — vertical overflow regression test
    createParagraph("Tall portrait image — the lightbox should constrain height to 80dvh."),
    createMediaBlock(portraitMedia.id),
    // Long caption — caption scroll test
    createParagraph(
      "Image with a long caption — the caption scrolls independently; the image is unaffected.",
    ),
    createMediaBlock(longCaptionMedia.id),
    // No caption — baseline (mediaDocs have no caption set)
    ...(mediaDocs[0]
      ? [
          createParagraph("Image without a caption — no caption area should appear."),
          createMediaBlock(mediaDocs[0].id),
        ]
      : []),
    // Grid with mixed aspect ratios
    createParagraph("Grid layout with a mix of aspect ratios."),
    createMediaCollageBlock(
      [mediaDocs[3]?.id, mediaDocs[0]?.id, mediaDocs[2]?.id, mediaDocs[1]?.id].filter(
        (id): id is number => id !== undefined,
      ),
      "grid",
    ),
    createParagraph("Carousel — click any image for a lightbox modal."),
    createMediaCollageBlock(
      [mediaDocs[3]?.id, mediaDocs[0]?.id, mediaDocs[2]?.id].filter(
        (id): id is number => id !== undefined,
      ),
      "carousel",
    ),
    createParagraph("Mixed carousel with wide, portrait, and captioned images."),
    createMediaCollageBlock(
      [wideMedia.id, portraitMedia.id, blueCoatMedia.id, itsBadMedia.id].filter(
        (id): id is number => id !== undefined,
      ),
      "carousel",
    ),
    createParagraph("Another grid layout with differently shaped images."),
    createMediaCollageBlock(
      [mediaDocs[0]?.id, itsBadMedia.id, blueCoatMedia.id].filter(
        (id): id is number => id !== undefined,
      ),
      "grid",
    ),
  ])

  // Create the article
  const title = "Grids, Carousels, and Captions: Exploring Rich Media Layouts"
  const article = await createArticle(payload, {
    title,
    content,
    authors: [writer.id],
    topics: topics,
    slug: "grids-carousels-captions-exploring-rich-media-layouts",
    heroImage: mediaDocs[Math.floor(Math.random() * mediaDocs.length)]?.id,
    meta: {
      title,
      description:
        "Demonstration of the media collage feature with grid and carousel layouts, showing clickable images with captions.",
      image: mediaDocs[0]?.id,
    },
  })

  return article.id
}
