import { describe, expect, it } from "vitest"
import { extractNarrationText } from "../extractNarrationText"

describe("extractNarrationText", () => {
  it("formats title, author, and publish date byline correctly", () => {
    const text = extractNarrationText({
      title: "Sample Article Title",
      populatedAuthors: [{ name: "Jane Doe" }, { name: "John Smith" }],
      publishedAt: "2026-07-20T00:00:00.000Z",
    })

    expect(text).toContain("Sample Article Title")
    expect(text).toContain("By Jane Doe, John Smith")
    expect(text).toContain("Published on July 20, 2026")
    expect(text).toContain('<break time="1.5s" />')
  })

  it("handles author string array fallback when populatedAuthors is absent", () => {
    const text = extractNarrationText({
      title: "Author Fallback",
      authors: ["Author One", "Author Two"],
    })

    expect(text).toContain("By Author One, Author Two")
  })

  it("extracts paragraph text from Lexical content", () => {
    const text = extractNarrationText({
      title: "Test Title",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", text: "First paragraph content." }],
            },
            {
              type: "paragraph",
              children: [{ type: "text", text: "Second paragraph content." }],
            },
          ],
        },
      },
    })

    expect(text).toContain("First paragraph content.\n\nSecond paragraph content.")
  })

  it("extracts lists, quotes, and block elements", () => {
    const text = extractNarrationText({
      title: "Lists and Quotes",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "quote",
              children: [{ type: "text", text: "This is a blockquote." }],
            },
            {
              type: "list",
              children: [
                {
                  type: "listitem",
                  children: [{ type: "text", text: "List item one" }],
                },
                {
                  type: "listitem",
                  children: [{ type: "text", text: "List item two" }],
                },
              ],
            },
          ],
        },
      },
    })

    expect(text).toContain("This is a blockquote.")
    expect(text).toContain("List item one\nList item two")
  })

  it("strips footnotes completely", () => {
    const text = extractNarrationText({
      title: "Footnote Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                { type: "text", text: "Text before footnote" },
                {
                  type: "inlineBlock",
                  fields: {
                    blockType: "footnote",
                    note: "This footnote citation should be omitted.",
                  },
                },
                { type: "text", text: " and text after footnote." },
              ],
            },
          ],
        },
      },
    })

    expect(text).toContain("Text before footnote and text after footnote.")
    expect(text).not.toContain("footnote citation")
  })

  it("uses custom block description field with clean block spacing", () => {
    const text = extractNarrationText({
      title: "Block Description Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "interactiveMap",
                description: "A map showing voting shifts across districts.",
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("A map showing voting shifts across districts.")
  })

  it("falls back to legacy message for custom blocks without description", () => {
    const text = extractNarrationText({
      title: "Fallback Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "interactiveMap",
              },
            },
            {
              type: "block",
              fields: {
                blockType: "code",
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("To view this Interactive Map, please refer to the article.")
    expect(text).toContain("To view this Code, please refer to the article.")
  })

  it("reuses media alt text or caption as description for mediaBlock", () => {
    const textWithAlt = extractNarrationText({
      title: "Media Alt Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: {
                  alt: "A diagram illustrating quantum superposition.",
                },
              },
            },
          ],
        },
      },
    })

    expect(textWithAlt).toContain("A diagram illustrating quantum superposition.")

    const textWithCaption = extractNarrationText({
      title: "Media Caption Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: {
                  caption: {
                    root: {
                      type: "root",
                      children: [
                        {
                          type: "paragraph",
                          children: [{ type: "text", text: "Caption plain text description." }],
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      },
    })

    expect(textWithCaption).toContain("Caption plain text description.")
  })

  it("uses snapshot title for socialEmbed when description is missing", () => {
    const text = extractNarrationText({
      title: "Social Embed Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "socialEmbed",
                snapshot: {
                  title: "Post about technological breakthroughs",
                },
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("Post about technological breakthroughs")
  })

  it("omits visual rules like horizontalrule and squiggleRule", () => {
    const text = extractNarrationText({
      title: "Rules Test",
      content: {
        root: {
          type: "root",
          children: [
            { type: "paragraph", children: [{ type: "text", text: "Paragraph 1" }] },
            { type: "horizontalrule" },
            { type: "squiggleRule" },
            { type: "paragraph", children: [{ type: "text", text: "Paragraph 2" }] },
          ],
        },
      },
    })

    expect(text).toContain("Paragraph 1\n\nParagraph 2")
    expect(text).not.toContain("horizontalrule")
    expect(text).not.toContain("squiggleRule")
  })

  it("inserts break tags for headings", () => {
    const text = extractNarrationText({
      title: "Heading Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "heading",
              tag: "h2",
              children: [{ type: "text", text: "Section Heading" }],
            },
            {
              type: "paragraph",
              children: [{ type: "text", text: "Paragraph text under section." }],
            },
          ],
        },
      },
    })

    expect(text).toContain(
      'Section Heading\n<break time="1.0s" />\n\nParagraph text under section.',
    )
  })
})
