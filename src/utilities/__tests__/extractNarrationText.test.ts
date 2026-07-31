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
    expect(text).not.toContain("<break")
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

  it("generates uppercase placeholder with details for block types", () => {
    const text = extractNarrationText({
      title: "Block Placeholder Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "interactiveMap",
                widgetTitle: "Voting shifts map",
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("<< INTERACTIVE MAP: Voting shifts map >>")
  })

  it("falls back to uppercase placeholders for custom blocks without detail", () => {
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

    expect(text).toContain("<< INTERACTIVE MAP >>")
    expect(text).toContain("<< CODE >>")
  })

  it("extracts banner content text when description is missing", () => {
    const text = extractNarrationText({
      title: "Banner Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "banner",
                content: {
                  root: {
                    type: "root",
                    children: [
                      {
                        type: "paragraph",
                        children: [{ type: "text", text: "Important announcement text." }],
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("Important announcement text.")
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

  it("extracts alt text for mediaCollage blocks", () => {
    const text = extractNarrationText({
      title: "Collage Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaCollage",
                images: [
                  { media: { alt: "First collage image" } },
                  { media: { alt: "Second collage image" } },
                ],
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("First collage image\nSecond collage image")
  })

  it("resolves unpopulated media IDs via mediaMap for mediaBlock and mediaCollage", () => {
    const text = extractNarrationText({
      title: "MediaMap Lookup Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: 42,
              },
            },
            {
              type: "block",
              fields: {
                blockType: "mediaCollage",
                images: [{ media: 101 }, { media: "abc" }],
              },
            },
          ],
        },
      },
      mediaMap: {
        42: { alt: "Single image from mediaMap" },
        101: { alt: "Collage image 1 from mediaMap" },
        abc: { alt: "Collage image 2 from mediaMap" },
      },
    })

    expect(text).toContain("Single image from mediaMap")
    expect(text).toContain("Collage image 1 from mediaMap\nCollage image 2 from mediaMap")
  })

  it("generates clear all-caps placeholders with filename or ID for media blocks missing alt/caption", () => {
    const text = extractNarrationText({
      title: "Missing Media Alt Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: 99,
              },
            },
            {
              type: "block",
              fields: {
                blockType: "mediaCollage",
                images: [{ media: 102 }, { media: "xyz" }],
              },
            },
          ],
        },
      },
      mediaMap: {
        99: { filename: "quantum_superposition.png" },
        102: { filename: "collage1.jpg" },
        xyz: {}, // no filename or alt
      },
    })

    expect(text).toContain("<< MEDIA BLOCK: quantum_superposition.png >>")
    expect(text).toContain("<< MEDIA BLOCK: collage1.jpg >>\n<< MEDIA BLOCK: ID: xyz >>")
  })

  it("formats inline math block placeholders in double angle brackets", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                { type: "text", text: "Theory of relativity: " },
                {
                  type: "inlineBlock",
                  fields: {
                    blockType: "inlineMathBlock",
                    math: "E=mc^2",
                  },
                },
              ],
            },
          ],
        },
      },
    })
    expect(text).toContain("Theory of relativity: << INLINE MATH BLOCK: E=mc^2 >>")
  })

  it("falls back to generic message for socialEmbed when description is missing", () => {
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

    expect(text).toContain("<< SOCIAL EMBED >>")
    expect(text).not.toContain("Post about technological breakthroughs")
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

    expect(text).toContain("Section Heading\n\nParagraph text under section.")
  })

  it("prioritizes caption over alt text when both are present", () => {
    const text = extractNarrationText({
      title: "Precedence Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: {
                  alt: "Alternate image description",
                  caption: {
                    root: {
                      type: "root",
                      children: [
                        {
                          type: "paragraph",
                          children: [{ type: "text", text: "Narrated caption description" }],
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

    expect(text).toContain("Narrated caption description")
    expect(text).not.toContain("Alternate image description")
  })

  it("handles soft linebreaks (linebreak nodes) correctly", () => {
    const text = extractNarrationText({
      title: "Soft Linebreak Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                { type: "text", text: "First line" },
                { type: "linebreak" },
                { type: "text", text: "Second line" },
              ],
            },
          ],
        },
      },
    })

    expect(text).toContain("First line\nSecond line")
  })

  it("extracts text from tables with cell spacing and row newlines", () => {
    const text = extractNarrationText({
      title: "Table Test",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "table",
              children: [
                {
                  type: "tablerow",
                  children: [
                    {
                      type: "tablecell",
                      children: [{ type: "text", text: "Cell A1" }],
                    },
                    {
                      type: "tablecell",
                      children: [{ type: "text", text: "Cell A2" }],
                    },
                  ],
                },
                {
                  type: "tablerow",
                  children: [
                    {
                      type: "tablecell",
                      children: [{ type: "text", text: "Cell B1" }],
                    },
                    {
                      type: "tablecell",
                      children: [{ type: "text", text: "Cell B2" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    })

    expect(text).toContain("Cell A1 Cell A2\nCell B1 Cell B2")
  })
})
