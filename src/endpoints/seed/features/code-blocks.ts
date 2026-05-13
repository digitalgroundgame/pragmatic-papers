import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { createArticle, validateWriters } from "../articles"
import { createHeadingNode, createParagraph, createRichText } from "../richtext"

const createCodeBlock = (language: "typescript" | "javascript" | "css", code: string) => ({
  type: "block",
  fields: {
    blockType: "code",
    language,
    code,
  },
  format: "",
  version: 2,
})

export const createCodeBlocksArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  validateWriters(writers)

  const writer = writers[0]!
  const title = "Code Blocks: Syntax Samples for Authors"

  const article = await createArticle(payload, {
    title,
    content: createRichText([
      createParagraph(
        "Code blocks support the default language choices available in the editor. These examples give authors and editors a quick rendering reference.",
      ),
      createHeadingNode("TypeScript", "h2"),
      createCodeBlock(
        "typescript",
        "type Colour = 'black' | 'white'\ntype Gender = 'male' | 'female' | string\ntype Person = {\n  name: string\n  colour: Colour\n  gender: Gender\n}\n\nexport const createSamplePerson = (): Person => ({\n  name: 'Destiny',\n  colour: 'black',\n  gender: 'female'\n})",
      ),
      createHeadingNode("JavaScript", "h2"),
      createCodeBlock(
        "javascript",
        "const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })\n\nconsole.log(formatter.format(new Date()))",
      ),
      createHeadingNode("CSS", "h2"),
      createCodeBlock(
        "css",
        ".icon-grid {\n  display: grid;\n  gap: 1rem;\n  color: var(--brand);\n}",
      ),
      createParagraph("Each sample should render with syntax highlighting and a 'Copy' button."),
    ]),
    authors: [writer.id],
    topics,
    slug: "code-blocks-syntax-samples-for-authors",
    heroImage: mediaDocs[1]?.id ?? mediaDocs[0]?.id,
    meta: {
      title,
      description: "A seeded article demonstrating the default Code block languages.",
      image: mediaDocs[1]?.id ?? mediaDocs[0]?.id,
    },
  })

  return article.id
}
