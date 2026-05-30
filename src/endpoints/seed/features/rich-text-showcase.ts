import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"
import { createArticle } from "../articles"
import {
  TextFormat,
  createHeadingNode,
  createHorizontalRuleNode,
  createListItemNode,
  createListNode,
  createParagraph,
  createQuoteNode,
  createRichText,
  createTableCellNode,
  createTableHeaderNode,
  createTableNode,
  createTableRowNode,
  createTextNode,
} from "../richtext"

export const createRichTextShowcaseArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  const writer = writers[0]!

  const title = "The Written Word: A Survey of Text Formatting"

  const article = await createArticle(payload, {
    title,
    content: createRichText([
      // ── Normal Text ────────────────────────────────────────────────────────
      createParagraph(
        "Every publishing platform makes choices about which formatting primitives to expose to authors. This article exercises all of them: headings, emphasis, lists, tables, links, media, and more — giving editors a single reference point to inspect how each element renders.",
      ),

      // ── Heading 2 ──────────────────────────────────────────────────────────
      createHeadingNode("Foundations of Emphasis", "h2"),

      // ── Bold Text ──────────────────────────────────────────────────────────
      createParagraph([
        createTextNode("Bold type draws the eye to what matters most. "),
        createTextNode(
          "Critical terms, warnings, and key conclusions are natural candidates for bold.",
          TextFormat.Bold,
        ),
        createTextNode(
          " Overusing it dilutes its effect, so restraint is the hallmark of good editorial judgement.",
        ),
      ]),

      // ── Italic Text ────────────────────────────────────────────────────────
      createParagraph([
        createTextNode("Italics serve a different register. Titles of works — "),
        createTextNode("The Elements of Style", TextFormat.Italic),
        createTextNode(", "),
        createTextNode("Being and Time", TextFormat.Italic),
        createTextNode(
          " — as well as foreign-language phrases and moments of subtle stress are all conventional homes for italic type.",
        ),
      ]),

      // ── Underlined Text ────────────────────────────────────────────────────
      createParagraph([
        createTextNode("Before hyperlinks colonised the underline, "),
        createTextNode("underlined text", TextFormat.Underline),
        createTextNode(
          " was the standard way to mark emphasis in typewritten manuscripts. Today it is used sparingly to avoid confusion with links.",
        ),
      ]),

      // ── Strikethrough Text ─────────────────────────────────────────────────
      createParagraph([
        createTextNode("Strikethrough communicates deliberate revision in plain sight. "),
        createTextNode("The original claim was entirely correct.", TextFormat.Strikethrough),
        createTextNode(
          " Showing the abandoned text alongside the replacement gives readers a transparent view of editorial thinking.",
        ),
      ]),

      // ── Heading 2 ──────────────────────────────────────────────────────────
      createHeadingNode("Precision in Scientific Writing", "h2"),

      // ── Heading 3 ──────────────────────────────────────────────────────────
      createHeadingNode("Exponents and Indices", "h3"),

      // ── Heading 4 ──────────────────────────────────────────────────────────
      createHeadingNode("Superscript and Subscript", "h4"),

      // ── Super and Sub Text ─────────────────────────────────────────────────
      createParagraph([
        createTextNode(
          "Superscript and subscript are indispensable in scientific notation. Einstein's mass–energy equivalence is expressed as E = mc",
        ),
        createTextNode("2", TextFormat.Superscript),
        createTextNode(
          ", where the exponent sits above the baseline. Conversely, the molecular formula for water is written H",
        ),
        createTextNode("2", TextFormat.Subscript),
        createTextNode(
          "O, with the atom count tucked below. Getting these right is not cosmetic — misrendering exponents can alter the meaning of an equation entirely.",
        ),
      ]),

      // ── Heading 2 ──────────────────────────────────────────────────────────
      createHeadingNode("External References", "h2"),

      // ── Basic Link ─────────────────────────────────────────────────────────
      createParagraph([
        createTextNode(
          "Prose should not stand alone when authoritative sources exist. The Chicago Manual of Style, available at ",
        ),
        {
          children: [createTextNode("chicagomanualofstyle.org")],
          direction: "ltr" as const,
          fields: {
            linkType: "custom" as const,
            newTab: true,
            url: "https://www.chicagomanualofstyle.org",
          },
          format: "" as const,
          indent: 0,
          type: "link" as const,
          version: 1,
        },
        createTextNode(
          ", is the reference authority for academic and editorial publishing in North America.",
        ),
      ]),

      // ── Horizontal Rule ────────────────────────────────────────────────────
      createHorizontalRuleNode(),

      // ── Heading 2 ──────────────────────────────────────────────────────────
      createHeadingNode("Structured Lists", "h2"),

      // ── Heading 3 ──────────────────────────────────────────────────────────
      createHeadingNode("A Numbered Process", "h3"),

      // ── Ordered List ───────────────────────────────────────────────────────
      createListNode(
        [
          createListItemNode("Identify the core argument and state it plainly.", 1),
          createListItemNode("Support each claim with evidence drawn from primary sources.", 2),
          createListItemNode("Anticipate the strongest objection and address it directly.", 3),
          createListItemNode("Conclude by restating the argument in light of the evidence.", 4),
        ],
        "number",
      ),

      // ── Heading 3 ──────────────────────────────────────────────────────────
      createHeadingNode("Key Considerations", "h3"),

      // ── Unordered List ─────────────────────────────────────────────────────
      createListNode(
        [
          createListItemNode("Audience — who will read this, and what do they already know?", 1),
          createListItemNode("Register — formal, conversational, or technical?", 2),
          createListItemNode("Length — is every sentence earning its place?", 3),
          createListItemNode(
            "Consistency — do headings, lists, and captions follow the same logic?",
            4,
          ),
        ],
        "bullet",
      ),

      // ── Heading 3 ──────────────────────────────────────────────────────────
      createHeadingNode("Editing Checklist", "h3"),

      // ── Check List ─────────────────────────────────────────────────────────
      createListNode(
        [
          createListItemNode("Spell-check completed", 1, true),
          createListItemNode("All citations verified against primary sources", 2, true),
          createListItemNode("Headings reviewed for parallel structure", 3, true),
          createListItemNode("Captions added to all media", 4, false),
          createListItemNode("Final read-through by a second editor", 5, false),
        ],
        "check",
      ),

      // ── Heading 2 ──────────────────────────────────────────────────────────
      createHeadingNode("Voice and Authority", "h2"),

      // ── Blockquote ─────────────────────────────────────────────────────────
      createQuoteNode(
        "Writing is thinking. To write well is to think clearly. That is why it is so hard. — David McCullough",
      ),

      createParagraph(
        "Blockquotes signal to the reader that a voice other than the author's is speaking. They interrupt the flow deliberately, asking the reader to pause and weigh borrowed words against the surrounding argument.",
      ),

      // ── Horizontal Rule ────────────────────────────────────────────────────
      createHorizontalRuleNode(),

      // ── Heading 2 ──────────────────────────────────────────────────────────
      createHeadingNode("Formatting Comparison", "h2"),

      createParagraph(
        "The table below catalogues each formatting type covered in this article alongside its conventional use and the HTML element or CSS property that realises it.",
      ),

      // ── Table ──────────────────────────────────────────────────────────────
      createTableNode([
        createTableRowNode([
          createTableHeaderNode("Format"),
          createTableHeaderNode("Conventional Use"),
          createTableHeaderNode("HTML / CSS"),
        ]),
        createTableRowNode([
          createTableCellNode("Bold"),
          createTableCellNode("Critical terms, warnings"),
          createTableCellNode("<strong> / font-weight: bold"),
        ]),
        createTableRowNode([
          createTableCellNode("Italic"),
          createTableCellNode("Titles, foreign phrases, stress"),
          createTableCellNode("<em> / font-style: italic"),
        ]),
        createTableRowNode([
          createTableCellNode("Underline"),
          createTableCellNode("Emphasis (use sparingly)"),
          createTableCellNode("<u> / text-decoration: underline"),
        ]),
        createTableRowNode([
          createTableCellNode("Strikethrough"),
          createTableCellNode("Revisions, deprecated content"),
          createTableCellNode("<s> / text-decoration: line-through"),
        ]),
        createTableRowNode([
          createTableCellNode("Superscript"),
          createTableCellNode("Exponents, ordinal suffixes"),
          createTableCellNode("<sup>"),
        ]),
        createTableRowNode([
          createTableCellNode("Subscript"),
          createTableCellNode("Chemical formulae, footnote markers"),
          createTableCellNode("<sub>"),
        ]),
      ]),

      // ── Heading 2 ──────────────────────────────────────────────────────────
      createHeadingNode("Conclusion", "h2"),

      createParagraph(
        "Rich text is more than decoration. Each formatting choice communicates something about the relationship between ideas: what is primary, what is auxiliary, what is borrowed, and what is being revised. Used with care, these primitives give authors a precise vocabulary for shaping how readers move through a text.",
      ),
    ]),
    authors: [writer.id],
    topics,
    slug: "rich-text-showcase",
    heroImage: mediaDocs[Math.floor(Math.random() * mediaDocs.length)]?.id,
    meta: {
      title,
      description:
        "A reference article showcasing all available basic rich-text formatting: headings, lists, tables, links, and more.",
      image: mediaDocs[0]?.id,
    },
  })

  return article.id
}
