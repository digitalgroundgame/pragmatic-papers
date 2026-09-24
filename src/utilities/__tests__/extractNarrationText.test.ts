import { describe, expect, it } from "vitest"
import { extractNarrationText } from "../extractNarrationText"

describe("extractNarrationText", () => {
  it("formats title, author, and publish date byline correctly", () => {
    const text = extractNarrationText({
      title: "Sample Article Title",
      authors: [{ name: "Jane Doe" }, { name: "John Smith" }],
      publishedAt: "2026-07-20T00:00:00.000Z",
    })

    expect(text).toContain("Sample Article Title")
    expect(text).toContain("By Jane Doe, John Smith")
    expect(text).toContain("Published on July 20, 2026")
    expect(text).not.toContain("<break")
  })

  it("handles author string array fallback", () => {
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

  it("describes a titled visual block as a spoken aside", () => {
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

    expect(text).toContain('(An interactive map titled "Voting shifts map".)')
  })

  it("describes visual blocks without a title using a generic spoken aside", () => {
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

    expect(text).toContain("(An interactive map.)")
    expect(text).toContain("(A code sample.)")
    expect(text).not.toContain("<<")
  })

  it("narrates banner content as a set-apart note", () => {
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

    expect(text).toContain("Note: Important announcement text.")
    expect(text).not.toContain("<<")
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

    expect(textWithAlt).toContain("(An image: A diagram illustrating quantum superposition.)")

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

    expect(textWithCaption).toContain("(An image: Caption plain text description.)")
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

    expect(text).toContain("(A gallery of images: First collage image; Second collage image.)")
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

    expect(text).toContain("(An image: Single image from mediaMap.)")
    expect(text).toContain(
      "(A gallery of images: Collage image 1 from mediaMap; Collage image 2 from mediaMap.)",
    )
  })

  it("omits filenames and IDs from narration when alt/caption are missing", () => {
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

    // Filenames read terribly aloud, so they are never spoken.
    expect(text).not.toContain("quantum_superposition.png")
    expect(text).not.toContain("collage1.jpg")
    expect(text).toContain("(An image.)")
    expect(text).toContain("(A gallery of images.)")
  })

  it("collapses inline math to a spoken phrase without reading LaTeX", () => {
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
    expect(text).toContain("Theory of relativity: a mathematical formula")
    expect(text).not.toContain("E=mc^2")
  })

  it("speaks an inline math description in place of the generic phrase", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                { type: "text", text: "Einstein gave us " },
                {
                  type: "inlineBlock",
                  fields: {
                    blockType: "inlineMathBlock",
                    math: "E=mc^2",
                    description: "mass-energy equivalence",
                  },
                },
                { type: "text", text: "." },
              ],
            },
          ],
        },
      },
    })

    // Inline descriptions read as part of the sentence, not as an aside.
    expect(text).toContain("Einstein gave us mass-energy equivalence.")
    expect(text).not.toContain("a mathematical formula")
    expect(text).not.toContain("E=mc^2")
  })

  it("names a display math formula from its description", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "displayMathBlock",
                math: "a^2 + b^2 = c^2",
                description: "the Pythagorean theorem",
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("(A mathematical formula: the Pythagorean theorem.)")
    expect(text).not.toContain("a^2 + b^2 = c^2")
  })

  it("falls back to the generic aside when a display math block has no description", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "displayMathBlock",
                math: "a^2 + b^2 = c^2",
                description: "   ",
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("(A mathematical formula.)")
  })

  it("reads a timeline's events as a spoken list, one line each", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "timeline",
                title: "Fall of Rome",
                events: [
                  {
                    date: "0410-08-24T00:00:00.000Z",
                    title: "Visigoths sack Rome",
                    description: "Alaric enters the city",
                  },
                  {
                    date: "0476-09-04T00:00:00.000Z",
                    title: "Romulus Augustulus is deposed",
                  },
                  // A citation link has nothing to say aloud and must not leak
                  // into the narration.
                  {
                    date: "0480-01-01T00:00:00.000Z",
                    description: "Julius Nepos is murdered",
                    enableCitation: true,
                    citation: { url: "https://example.com/nepos" },
                  },
                ],
              },
            },
          ],
        },
      },
    })

    expect(text).toContain(
      '(A timeline titled "Fall of Rome": August 24, 410: Visigoths sack Rome. Alaric enters the city.\n' +
        "September 4, 476: Romulus Augustulus is deposed.\n" +
        "January 1, 480: Julius Nepos is murdered.)",
    )
    expect(text).not.toContain("example.com")
  })

  it("skips unreadable timeline event fragments", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "timeline",
                events: [
                  // An unparseable date with no text leaves nothing to say.
                  { date: "not a date" },
                  // A dateless event still narrates its own words.
                  { title: "Sometime in late antiquity" },
                  { date: "not a date", description: "The empire quietly ends" },
                ],
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("(A timeline: Sometime in late antiquity.\nThe empire quietly ends.)")
    expect(text).not.toContain("not a date")
  })

  it("falls back to the bare aside when a timeline has no events", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "timeline",
                title: "Fall of Rome",
                events: [],
              },
            },
          ],
        },
      },
    })

    expect(text).toContain('(A timeline titled "Fall of Rome".)')
  })

  it("falls back to generic spoken description for socialEmbed when platform is missing", () => {
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
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("(An embedded social media post.)")
  })

  it("describes a socialEmbed with its snapshot title when the fetch succeeded", () => {
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
                platform: "reddit",
                url: "https://reddit.com/r/history/comments/abc123",
                snapshot: {
                  status: "ok",
                  title: "Post about technological breakthroughs",
                },
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("(An embedded reddit post: Post about technological breakthroughs.)")
    // A spoken URL is unintelligible — the snapshot title replaces it, never
    // supplements it.
    expect(text).not.toContain("reddit.com")
  })

  it("ignores a snapshot title when the oEmbed fetch did not succeed", () => {
    const content = (status: unknown, title: string) => ({
      root: {
        type: "root",
        children: [
          {
            type: "block",
            fields: {
              blockType: "socialEmbed",
              platform: "twitter",
              snapshot: { status, title },
            },
          },
        ],
      },
    })

    // `buildSnapshot` writes sentinel titles like this one on the failure paths.
    const notFound = extractNarrationText({ content: content("not_found", "No adapter found") })
    expect(notFound).toContain("(An embedded twitter post.)")
    expect(notFound).not.toContain("No adapter found")

    // A network failure carries the previous title forward — it may no longer
    // describe what is at the URL, so it is not narrated.
    const timedOut = extractNarrationText({
      content: content("timeout", "Previously fetched post"),
    })
    expect(timedOut).toContain("(An embedded twitter post.)")
    expect(timedOut).not.toContain("Previously fetched post")

    // A snapshot that predates the status field is treated the same way.
    const noStatus = extractNarrationText({ content: content(undefined, "Legacy snapshot title") })
    expect(noStatus).toContain("(An embedded twitter post.)")
    expect(noStatus).not.toContain("Legacy snapshot title")
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

  // Headings are separated by a blank line, not an SSML <break> tag — the name
  // this test used to carry described a design that was never implemented.
  it("separates a heading from the text beneath it", () => {
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

    expect(text).toContain("(An image: Narrated caption description.)")
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

  it("describes timeline, math, and untitled map blocks as spoken asides", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "timeline",
                title: "WWII Timeline",
              },
            },
            {
              type: "block",
              fields: {
                blockType: "displayMathBlock",
                math: "f(x) = x^2",
              },
            },
            {
              type: "block",
              fields: {
                blockType: "interactiveMap",
                slug: 12345, // numeric slug must never be read aloud
              },
            },
          ],
        },
      },
    })

    expect(text).toContain('(A timeline titled "WWII Timeline".)')
    expect(text).toContain("(A mathematical formula.)")
    expect(text).not.toContain("f(x) = x^2")
    expect(text).toContain("(An interactive map.)")
    expect(text).not.toContain("12345")
  })

  it("covers complex resolveMediaInfo formats", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: {
                  value: {
                    id: 999,
                    alt: "quantum spin alt text",
                  },
                },
              },
            },
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: {
                  value: 888, // wraps ID
                },
              },
            },
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: {
                  id: 777, // simple object with id
                },
              },
            },
            {
              type: "block",
              fields: {
                blockType: "mediaBlock",
                media: {}, // empty object, should fallback to empty string representation
              },
            },
          ],
        },
      },
      mediaMap: {
        888: { alt: "Media from value ID lookup" },
        777: { alt: "Media from direct ID lookup" },
      },
    })

    expect(text).toContain("(An image: quantum spin alt text.)")
    expect(text).toContain("(An image: Media from value ID lookup.)")
    expect(text).toContain("(An image: Media from direct ID lookup.)")
    expect(text).toContain("(An image.)")
  })

  it("covers unknown/unsupported inlineBlock types", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                { type: "text", text: "Text before unknown inline block " },
                {
                  type: "inlineBlock",
                  fields: {
                    blockType: "unsupportedBlockType",
                  },
                },
                { type: "text", text: "and text after." },
              ],
            },
          ],
        },
      },
    })

    expect(text).toContain("Text before unknown inline block and text after.")
  })

  it("covers non-string author objects in extractNarrationText options", () => {
    const text = extractNarrationText({
      title: "Author Object Test",
      authors: [{ name: "John Object-Author" }, "Jane String-Author"],
    })

    expect(text).toContain("By John Object-Author, Jane String-Author")
  })

  it("extracts caption object text from mediaCollage image", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaCollage",
                images: [
                  {
                    media: {
                      caption: {
                        root: {
                          type: "root",
                          children: [
                            {
                              type: "paragraph",
                              children: [{ type: "text", text: "Collage Image Caption" }],
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("(A gallery of images: Collage Image Caption.)")
  })

  it("falls back to media details when resolveMediaInfo returns null in mediaCollage", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: {
                blockType: "mediaCollage",
                images: [
                  {
                    media: [], // resolveMediaInfo returns null
                  },
                  {
                    media: {
                      value: {}, // resolveMediaInfo returns null
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    })

    expect(text).toContain("(A gallery of images.)")
  })

  it("describes the legacy per-platform embed blocks by provider", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "block",
              fields: { blockType: "youtubeEmbed", url: "https://youtu.be/abc123" },
            },
            { type: "block", fields: { blockType: "tiktokEmbed" } },
            { type: "block", fields: { blockType: "twitterEmbed" } },
            { type: "block", fields: { blockType: "redditEmbed" } },
            { type: "block", fields: { blockType: "blueSkyEmbed" } },
          ],
        },
      },
    })

    expect(text).toContain("(An embedded YouTube video.)")
    expect(text).toContain("(An embedded TikTok video.)")
    expect(text).toContain("(An embedded Twitter post.)")
    expect(text).toContain("(An embedded Reddit post.)")
    expect(text).toContain("(An embedded Bluesky post.)")
    // A spoken URL is unintelligible and is never read aloud.
    expect(text).not.toContain("youtu.be")
  })

  it("names unhandled block types from the readable noun map", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            { type: "block", fields: { blockType: "cta", title: "Subscribe today" } },
            { type: "block", fields: { blockType: "formBlock" } },
            { type: "block", fields: { blockType: "collectionGrid" } },
          ],
        },
      },
    })

    expect(text).toContain('(A call to action titled "Subscribe today".)')
    expect(text).toContain("(A form.)")
    expect(text).toContain("(A collection grid.)")
  })

  it("falls back to the raw block type, with the right article, for an unmapped block", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            { type: "block", fields: { blockType: "authorSpotlight" } },
            { type: "block", fields: { blockType: "pullQuote" } },
          ],
        },
      },
    })

    expect(text).toContain("(An authorSpotlight.)")
    expect(text).toContain("(A pullQuote.)")
  })

  it("titles a fallback block from name or label when it has no title", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            { type: "block", fields: { blockType: "volumeView", name: "Volume III" } },
            { type: "block", fields: { blockType: "contributors", label: "Our team" } },
            // A numeric id-like title reads terribly aloud and must be dropped.
            { type: "block", fields: { blockType: "newsletterSignup", title: 12345 } },
            // An all-whitespace title is no title at all.
            { type: "block", fields: { blockType: "content", title: "   " } },
          ],
        },
      },
    })

    expect(text).toContain('(A volume view titled "Volume III".)')
    expect(text).toContain('(A contributors block titled "Our team".)')
    expect(text).toContain("(A newsletter signup.)")
    expect(text).not.toContain("12345")
    expect(text).toContain("(A content block.)")
  })

  it("describes a media block or collage that carries no media at all", () => {
    const text = extractNarrationText({
      content: {
        root: {
          type: "root",
          children: [
            { type: "block", fields: { blockType: "mediaBlock" } },
            { type: "block", fields: { blockType: "mediaCollage" } },
            // An images array that exists but is empty falls through the same way.
            { type: "block", fields: { blockType: "mediaCollage", images: [] } },
          ],
        },
      },
    })

    expect(text).toContain("(An image.)")
    expect(text).toContain("(A gallery of images.)")
  })

  it("emits nothing for empty containers an editor left behind", () => {
    const text = extractNarrationText({
      title: "Empty Containers",
      content: {
        root: {
          type: "root",
          children: [
            { type: "heading", tag: "h2", children: [] },
            {
              type: "list",
              children: [{ type: "listitem", children: [{ type: "text", text: "" }] }],
            },
            {
              type: "table",
              children: [{ type: "tablerow", children: [{ type: "tablecell", children: [] }] }],
            },
            { type: "quote", children: [{ type: "text", text: "   " }] },
            { type: "paragraph", children: [{ type: "text", text: "The only line." }] },
          ],
        },
      },
    })

    // No stray blank lines between the byline and the one real paragraph.
    expect(text).toBe("Empty Containers\n\nThe only line.")
  })

  it("survives malformed nodes in the content tree", () => {
    const text = extractNarrationText({
      title: "Malformed Test",
      content: {
        root: {
          type: "root",
          children: [
            null,
            "not a node",
            { type: "paragraph", children: [{ type: "text", text: "Still readable." }] },
          ],
        },
      },
    })

    expect(text).toContain("Still readable.")
    expect(text).not.toContain("not a node")
  })
})
