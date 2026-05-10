import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"
import { createArticle } from "../articles"
import { fetchFileByURL } from "../media"
import { createRichTextFromParagraphs } from "../richtext"

export const createNarrationDemoArticle = async (
  payload: Payload,
  writer: User,
  narrator: User,
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  const title = "Narration Demo: The Pragmatic Papers Audio Player"
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

  const article = await createArticle(payload, {
    title,
    content: createRichTextFromParagraphs([
      "This is a test narration for an article on The Pragmatic Papers. It demonstrates how the audio player looks and feels with real audio content including the progress bar and playback controls.",
      transcript,
    ]),
    authors: [writer.id],
    topics,
    slug: "narration-demo",
    narration: narration.id,
    heroImage: mediaDocs[0]?.id,
    meta: {
      title,
      description: transcript,
      image: mediaDocs[0]?.id,
    },
  })

  return article.id
}
