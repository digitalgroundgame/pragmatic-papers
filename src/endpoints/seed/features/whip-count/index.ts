import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { whipCountPath } from "@/collections/WhipCounts/tag"

import { createArticle, validateWriters } from "../../articles"
import {
  createHeadingNode,
  createLinkNode,
  createListItemNode,
  createListNode,
  createParagraph,
  createRichText,
  createTextNode,
} from "../../richtext"
import senateLeader2026 from "./senate-leader-2026.json"

export const WHIP_COUNT_SLUG = "senate-majority-leader-2026"

/**
 * Whether creating failed because the slug is taken: Payload's unique check, thrown by the Local
 * API as a ValidationError on `slug`, or by `pnpm showcase`'s REST stand-in as its message.
 */
function isTakenSlug(err: unknown): boolean {
  const errors = (err as { data?: { errors?: { path?: string }[] } } | null)?.data?.errors
  if (errors?.some((e) => e.path === "slug")) return true
  return err instanceof Error && /field is invalid: slug\b/i.test(err.message)
}

/**
 * The Senate Democrats' 2026 leadership vote as a whip count. The data is a snapshot from
 * November 13, 2026: each senator's public position with the link it came from, and no
 * quotations, since the statements behind them were not checked against their sources.
 *
 * A count that is already there is left alone, so this can run again on a site that has one.
 * Any other failure (an account that may not create whip counts) is thrown, so a showcase
 * fails rather than publish an article that links to a missing page.
 */
export async function createSenateLeaderWhipCount(
  payload: Payload,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await payload.create({
      collection: "whip-counts",
      context,
      data: {
        title: "Who will lead Senate Democrats?",
        slug: WHIP_COUNT_SLUG,
        intro:
          "Chuck Schumer and Chris Van Hollen are competing to be Senate majority leader. The Democratic caucus votes by secret ballot on December 1.",
        methodology:
          "A snapshot from November 13, 2026, for demonstration. A senator counts as backing a candidate only when they or their office said so on the record; a lean is praise without a commitment, or reporting that their support is expected. Blocs and tags are editorial groupings.",
        data: senateLeader2026,
        _status: "published",
        publishedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    if (!isTakenSlug(err)) throw err
    payload.logger.info(`Whip count "${WHIP_COUNT_SLUG}" is already there; left as it is.`)
  }
}

/** An article that introduces whip counts and links to the seeded one, which it creates. */
export const createWhipCountArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
  context?: Record<string, unknown>,
): Promise<number> => {
  validateWriters(writers)
  if (mediaDocs.length < 1) throw new Error("createWhipCountArticle requires a media document")

  await createSenateLeaderWhipCount(payload, context)

  const title = "Whip Counts: Draft Your Own Leadership Vote"
  const article = await createArticle(
    payload,
    {
      title,
      slug: "whip-counts-draft-your-own-leadership-vote",
      authors: writers.map((writer) => writer.id),
      topics,
      heroImage: mediaDocs[0]!.id,
      meta: {
        title,
        description:
          "A whip count tracks a leadership vote voter by voter, and lets a reader draft their own guess of how it breaks.",
        image: mediaDocs[0]!.id,
      },
      content: createRichText([
        createParagraph([
          createTextNode(
            "A whip count is an interactive page that follows a leadership vote one voter at a time. The first is the Senate Democrats' choice of majority leader: ",
          ),
          createLinkNode("Who will lead Senate Democrats?", whipCountPath(WHIP_COUNT_SLUG)),
          createTextNode(
            " It needs the interactives experiment switched on in Settings; with it off, the link is a 404.",
          ),
        ]),
        createHeadingNode("What a reader can do", "h2"),
        createListNode(
          [
            createListItemNode(
              "See the public count: who has backed each candidate, who leans, and who has said nothing, against the votes needed to win.",
            ),
            createListItemNode(
              "Draft their own count, one senator at a time in the table, or a whole bloc, tag, or the incoming class at once.",
            ),
            createListItemNode(
              "Count the outgoing senators as voters or leave them out, which changes the majority.",
            ),
          ],
          "bullet",
        ),
        createHeadingNode("What an editor can do", "h2"),
        createParagraph(
          "Under Whip counts in the admin, an editor changes a senator's position, the statement behind it and its source in a table and saves, or pastes a whole count as JSON. Saving checks the data and says what is wrong with it.",
        ),
      ]),
    },
    context,
  )
  return article.id
}
