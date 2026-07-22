import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"
import { createArticle } from "../articles"
import { fetchFileByURL } from "../media"
import {
  createHeadingNode,
  createParagraph,
  createQuoteNode,
  createRichText,
  createRichTextFromParagraphs,
  createTextNode,
} from "../richtext"

const createBannerBlock = (message: string) => ({
  type: "block",
  fields: {
    blockType: "banner",
    style: "info" as const,
    content: {
      root: {
        type: "root",
        children: [createParagraph(message)],
      },
    },
  },
  format: "",
  version: 2,
})

const createMediaBlock = (mediaId: number) => ({
  type: "block",
  fields: {
    blockType: "mediaBlock",
    media: mediaId,
  },
  format: "",
  version: 2,
})

const createCodeBlock = (code: string, description: string) => ({
  type: "block",
  fields: {
    blockType: "code",
    language: "typescript",
    code,
    description,
  },
  format: "",
  version: 2,
})

const createFootnoteInlineBlock = (note: string) => ({
  type: "inlineBlock",
  fields: {
    blockType: "footnote",
    id: crypto.randomUUID(),
    note,
    attributionEnabled: false,
  },
  version: 1,
})

export const createNarrationDemoArticle = async (
  payload: Payload,
  writer: User,
  narrator: User,
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  const title = "Narration Demo: The Pragmatic Papers Audio Player & Narration Extraction"
  const transcript =
    "I believe that this Nation should commit itself, to achieving the goal, before this decade is out, of landing a man on the Moon and returning him safely to the Earth."
  const file = await fetchFileByURL(
    "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8d/Discurso_de_Kennedy.ogg/Discurso_de_Kennedy.ogg.mp3",
  )

  const narration = await payload.create({
    collection: "media",
    data: {
      narrator: narrator.id,
      caption: createRichTextFromParagraphs([transcript]),
    },
    file,
  })

  const heroMediaId = mediaDocs[0]?.id

  const article = await createArticle(payload, {
    title,
    content: createRichText([
      createParagraph([
        createTextNode(
          "This article demonstrates audio narration playback and the Narration Plain Text Extractor. In the admin panel, switch to the ",
        ),
        createTextNode("Narration"),
        createTextNode(
          " tab to generate clean, ElevenLabs-ready narration text formatted with bylines, heading break tags, custom block descriptions, and stripped citations.",
        ),
        createFootnoteInlineBlock(
          "Citations and inline footnote markers are omitted entirely during narration extraction.",
        ),
      ]),

      createHeadingNode("Historical Context", "h2"),
      createParagraph(
        "On May 25, 1961, President John F. Kennedy addressed a joint session of Congress to outline the ambitious vision for American space exploration.",
      ),

      createQuoteNode(transcript),

      createBannerBlock("Notice: Historical audio recording included below."),

      ...(heroMediaId
        ? [createHeadingNode("Visual Archives", "h2"), createMediaBlock(heroMediaId)]
        : []),

      createHeadingNode("Audio Processing Sample", "h2"),
      createCodeBlock(
        "const synthesizeAudio = async (text: string) => {\n  return await elevenlabs.generate({ text, voice: 'Rachel' })\n}",
        "TypeScript function processing audio waveforms for ElevenLabs voice-over synthesis.",
      ),

      createParagraph(
        "When generating narration text in the Narration tab, each custom block uses its narration description, headings receive pause tags, and footnotes are stripped for seamless voice-over output.",
      ),
    ]),
    authors: [writer.id],
    topics,
    slug: "narration-demo",
    narration: narration.id,
    heroImage: heroMediaId,
    meta: {
      title,
      description: transcript,
      image: heroMediaId,
    },
  })

  return article.id
}
