import type { LinkField, Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { type TimelineEvent } from "@/components/Timeline/types"
import { createArticle, validateWriters } from "../articles"
import { createParagraph, createRichText } from "../richtext"

const buildCitation = (citation?: LinkField) =>
  citation
    ? { type: "custom" as const, url: citation.url, label: citation.label, newTab: true }
    : undefined

const createTimelineBlock = (events: TimelineEvent[], title?: string) => ({
  type: "block",
  fields: {
    blockType: "timeline",
    title: title ?? null,
    events: events.map((e) => ({
      date: e.date,
      title: e.title ?? null,
      description: e.description,
      avatar: e.avatar ?? null,
      enableCitation: Boolean(e.citation),
      ...(e.citation && { citation: buildCitation(e.citation) }),
    })),
  },
  format: "",
  version: 2,
})

export const createTimelineArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  validateWriters(writers)
  const writer = writers[0]!

  if (mediaDocs.length === 0) {
    throw new Error("createTimelineArticle requires at least one media document")
  }

  const avatar = (i: number) => mediaDocs[i % mediaDocs.length]!.id
  const cite = (n: number) => ({
    url: `https://example.com/source-${n}`,
    label: `Source ${n}`,
  })

  const events: TimelineEvent[] = [
    {
      date: "2024-01-05",
      title: "Kickoff workshop",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.",
      avatar: avatar(0),
      citation: cite(1),
    },
    {
      date: "2024-01-18",
      title: "Research synthesis",
      description:
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      avatar: avatar(1),
      citation: cite(2),
    },
    {
      date: "2024-02-02",
      title: "Design review",
      description:
        "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
      avatar: avatar(2),
    },
    {
      date: "2024-02-14",
      title: "Prototype freeze",
      description:
        "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      avatar: avatar(3),
      citation: cite(4),
    },
    {
      date: "2024-02-27",
      title: "Stakeholder sign-off",
      description:
        "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
      avatar: avatar(0),
      citation: cite(5),
    },
    {
      date: "2024-03-06",
      title: "Beta launch",
      citation: cite(6),
    },
    {
      date: "2024-03-19",
      title: "Performance tuning",
      description:
        "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.",
      avatar: avatar(1),
    },
    {
      date: "2024-04-01",
      title: "Content migration",
      description:
        "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.",
      avatar: avatar(2),
    },
    {
      date: "2024-04-12",
      title: "Accessibility audit",
      description:
        "Sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam.",
    },
    {
      date: "2024-04-25",
      title: "Public release",
      avatar: avatar(3),
    },
  ]

  const content = createRichText([
    createParagraph(
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. The timeline below presents a sequence of events with per-event context — dates, descriptions, avatars, and citations.",
    ),
    createTimelineBlock(events, "A sample timeline"),
    createParagraph(
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. The timeline below presents a sequence of events with per-event context — dates, descriptions, avatars, and citations.",
    ),
  ])

  const title = "Lorem Ipsum Timeline"
  const heroImage = mediaDocs[0]!.id

  const article = await createArticle(payload, {
    title,
    content,
    authors: [writer.id],
    topics,
    slug: "lorem-ipsum-timeline",
    heroImage,
    meta: {
      title,
      description: "A demonstration of the timeline block with placeholder content.",
      image: heroImage,
    },
  })

  return article.id
}
