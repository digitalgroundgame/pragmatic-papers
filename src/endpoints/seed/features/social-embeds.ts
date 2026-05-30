import type { Media, SocialEmbedBlock, User } from "@/payload-types"
import type { Payload } from "payload"
import { createArticle } from "../articles"
import {
  createParagraph,
  createRichText,
  generateLoremIpsumParagraphs,
  type SerializedLexicalNode,
} from "../richtext"

/**
 * One example URL per social media platform.
 */
const SOCIAL_MEDIA_URLS: Pick<SocialEmbedBlock, "platform" | "url" | "snapshot" | "id">[] = [
  {
    platform: "bluesky",
    url: "https://bsky.app/profile/destiny.gg/post/3lbjlth3tnc2k",
    // Set explicit, stable IDs so runtime revalidation can persist by `fields.id` reliably.
    id: "seed-socialEmbed-bluesky",
    snapshot: {
      status: "ok",
      // Intentionally old so revalidation runs on first article load (TTL is 30 days).
      fetchedAt: new Date().toISOString(),
      providerName: "Bluesky Social",
      providerURL: "https://bsky.app",
      authorName: "Destiny | Steven Bonnell II (@destiny.gg)",
      authorURL: "https://bsky.app/profile/destiny.gg",
      html: '<blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:zdkax6bg6xowo4yqsp5thweh/app.bsky.feed.post/3lbjlth3tnc2k" data-bluesky-cid="bafyreicokpbosckviuzdmxkimydk6onewbylqhrlafhahgj3eh6msaz7ie" data-bluesky-embed-color-mode="system"><p lang="en">I&#x27;m him, I&#x27;m that guy.</p>&mdash; Destiny | Steven Bonnell II (<a href="https://bsky.app/profile/did:plc:zdkax6bg6xowo4yqsp5thweh?ref_src=embed">@destiny.gg</a>) <a href="https://bsky.app/profile/did:plc:zdkax6bg6xowo4yqsp5thweh/post/3lbjlth3tnc2k?ref_src=embed">November 22, 2024 at 12:48 AM</a></blockquote>',
    },
  },
  {
    platform: "reddit",
    url: "https://www.reddit.com/r/news/comments/jptqj9/joe_biden_elected_president_of_the_united_states/",
    id: "seed-socialEmbed-reddit",
    snapshot: {
      status: "ok",
      fetchedAt: new Date().toISOString(),
      providerName: "reddit",
      providerURL: "https://www.reddit.com",
      authorName: "throwawaynumber53",
      title: "Joe Biden elected president of the United States",
      html: '<blockquote class="reddit-embed-bq" style="height:500px"> <a href="https://www.reddit.com/r/news/comments/jptqj9/joe_biden_elected_president_of_the_united_states/">Joe Biden elected president of the United States</a><br> by <a href="https://www.reddit.com/user/throwawaynumber53/">u/throwawaynumber53</a> in <a href="https://www.reddit.com/r/news/">news</a> </blockquote>',
    },
  },
  {
    platform: "tiktok",
    url: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
    id: "seed-socialEmbed-tiktok",
    snapshot: {
      status: "ok",
      fetchedAt: new Date().toISOString(),
      providerName: "TikTok",
      providerURL: "https://www.tiktok.com",
      authorName: "Scout, Suki & Stella",
      authorURL: "https://www.tiktok.com/@scout2015",
      title: "Scramble up ur name & I'll try to guess it😍❤️ #foryoupage #petsoftiktok #aesthetic",
      html: '<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@scout2015/video/6718335390845095173" data-video-id="6718335390845095173" data-embed-from="oembed" style="max-width:605px; min-width:325px;"> <section> <a target="_blank" title="@scout2015" href="https://www.tiktok.com/@scout2015?refer=embed">@scout2015</a> <p>Scramble up ur name & I\'ll try to guess it😍❤️ <a title="foryoupage" target="_blank" href="https://www.tiktok.com/tag/foryoupage?refer=embed">#foryoupage</a> <a title="petsoftiktok" target="_blank" href="https://www.tiktok.com/tag/petsoftiktok?refer=embed">#petsoftiktok</a> <a title="aesthetic" target="_blank" href="https://www.tiktok.com/tag/aesthetic?refer=embed">#aesthetic</a></p> <a target="_blank" title="♬ original sound - tiff" href="https://www.tiktok.com/music/original-sound-6689804660171082501?refer=embed">♬ original sound - tiff</a> </section> </blockquote> <script async src="https://www.tiktok.com/embed.js"></script>',
      thumbnailURL:
        "https://p19-common-sign.tiktokcdn-us.com/tos-maliva-p-0068/2367c7d45cf54a1397abd0e72bf22eac~tplv-tiktokx-origin.image?dr=9636&x-expires=1770062400&x-signature=SJ79uSqdQ0dBdJ52CgSnAHzr3VQ%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=useast5",
    },
  },
  {
    platform: "twitter",
    url: "https://twitter.com/Interior/status/463440424141459456",
    id: "seed-socialEmbed-twitter",
    snapshot: {
      status: "ok",
      fetchedAt: new Date().toISOString(),
      providerName: "Twitter",
      providerURL: "https://twitter.com",
      authorName: "US Department of the Interior",
      authorURL: "https://twitter.com/Interior",
      html: '<blockquote class="twitter-tweet" data-width="550" data-lang="en" data-dnt="true"><p lang="en" dir="ltr">Sunsets don&#39;t get much better than this one over <a href="https://twitter.com/GrandTetonNPS?ref_src=twsrc%5Etfw">@GrandTetonNPS</a>. <a href="https://twitter.com/hashtag/nature?src=hash&amp;ref_src=twsrc%5Etfw">#nature</a> <a href="https://twitter.com/hashtag/sunset?src=hash&amp;ref_src=twsrc%5Etfw">#sunset</a> <a href="http://t.co/YuKy2rcjyU">pic.twitter.com/YuKy2rcjyU</a></p>&mdash; US Department of the Interior (@Interior) <a href="https://twitter.com/Interior/status/463440424141459456?ref_src=twsrc%5Etfw">May 5, 2014</a></blockquote>',
    },
  },
  {
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    id: "seed-socialEmbed-youtube",
    snapshot: {
      status: "ok",
      fetchedAt: new Date().toISOString(),
      providerName: "YouTube",
      providerURL: "https://www.youtube.com",
      authorName: "Rick Astley",
      authorURL: "https://www.youtube.com/@RickAstleyYT",
      title: "Rick Astley - Never Gonna Give You Up",
      html: '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
      thumbnailURL: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    },
  },
] as const

type SocialEmbedBlockFields = Pick<
  SocialEmbedBlock,
  "url" | "platform" | "snapshot" | "hideMedia" | "hideThread" | "id"
> & {
  blockType: "socialEmbed"
}

interface SocialEmbedBlockNode {
  type: "block"
  fields: SocialEmbedBlockFields
  format: ""
  version: 2
}

/**
 * Creates a social embed block node for use within Lexical content
 */
function createSocialEmbedBlock(item: (typeof SOCIAL_MEDIA_URLS)[number]): SocialEmbedBlockNode {
  return {
    type: "block",
    fields: {
      blockType: "socialEmbed",
      url: item.url,
      platform: item.platform,
      id: item.id,
      snapshot: item.snapshot,
      ...(item.platform === "twitter" && {
        hideMedia: false,
        hideThread: true,
      }),
    },
    format: "",
    version: 2,
  }
}

/**
 * Creates article content with one social embed per platform, lorem ipsum between each.
 */
const createSocialEmbedContent = () => {
  const lipsumParagraphs = generateLoremIpsumParagraphs(2).map((text) => createParagraph(text))
  const children: SerializedLexicalNode[] = []

  for (const item of SOCIAL_MEDIA_URLS) {
    children.push(...lipsumParagraphs)
    children.push(createSocialEmbedBlock(item))
  }
  children.push(...lipsumParagraphs)

  return createRichText(children)
}

/**
 * Maps platform to legacy blockType
 */
const getLegacyBlockType = (platform: string): LegacySocialBlockType => {
  switch (platform) {
    case "twitter":
      return "twitterEmbed"
    case "youtube":
      return "youtubeEmbed"
    case "reddit":
      return "redditEmbed"
    case "bluesky":
      return "blueSkyEmbed"
    case "tiktok":
      return "tiktokEmbed"
    default:
      throw new Error(`Unknown platform: ${platform}`)
  }
}

type LegacySocialBlockType =
  | "twitterEmbed"
  | "youtubeEmbed"
  | "redditEmbed"
  | "blueSkyEmbed"
  | "tiktokEmbed"

interface LegacyEmbedBlockNode {
  type: "block"
  fields: {
    blockType: LegacySocialBlockType
    url: string
    hideMedia?: boolean
    hideThread?: boolean
  }
  format: ""
  version: 2
}

/**
 * Creates a legacy social embed block node for use within Lexical content
 */
function createLegacyEmbedBlock(item: (typeof SOCIAL_MEDIA_URLS)[number]): LegacyEmbedBlockNode {
  return {
    type: "block",
    fields: {
      blockType: getLegacyBlockType(item.platform ?? ""),
      url: item.url,
      ...(item.platform === "twitter" && {
        hideMedia: false,
        hideThread: false,
      }),
    },
    format: "",
    version: 2,
  }
}

/**
 * Creates article content with legacy social media blocks (one per platform), lorem ipsum between each.
 */
const createLegacySocialEmbedContent = () => {
  const lipsumParagraphs = generateLoremIpsumParagraphs(2).map((text) => createParagraph(text))
  const children: SerializedLexicalNode[] = []

  for (const item of SOCIAL_MEDIA_URLS) {
    children.push(...lipsumParagraphs)
    children.push(createLegacyEmbedBlock(item))
  }
  children.push(...lipsumParagraphs)

  return createRichText(children)
}

export const createSocialEmbedArticle = async (
  payload: Payload,
  writer: User,
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  if (!writer?.id) {
    throw new Error("Writer must have an ID")
  }

  const title = "Social Media Embed Test - All Variations"

  const article = await createArticle(
    payload,
    {
      title,
      content: createSocialEmbedContent(),
      authors: [writer.id],
      topics: topics,
      slug: "social-media-embed-test-all-variations",
      heroImage: mediaDocs[Math.floor(Math.random() * mediaDocs.length)]?.id,
      meta: {
        description:
          "Test article containing all possible social media block variations from the HOSTNAMES map.",
        image: mediaDocs[0]?.id ?? undefined,
      },
    },
    {
      // Seed provides snapshots explicitly (including intentionally stale ones).
      // Skip the SocialEmbed url hook that would otherwise rebuild snapshots on create.
      skipSocialEmbedSnapshot: true,
    },
  )

  return article.id
}

export const createLegacySocialEmbedArticle = async (
  payload: Payload,
  writer: User,
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  if (!writer?.id) {
    throw new Error("Writer must have an ID")
  }

  const title = "Legacy Social Media Embed Test - All Variations"

  const article = await createArticle(
    payload,
    {
      title,
      content: createLegacySocialEmbedContent(),
      authors: [writer.id],
      topics: topics,
      slug: "legacy-social-media-embed-test-all-variations",
      heroImage: mediaDocs[Math.floor(Math.random() * mediaDocs.length)]?.id,
      meta: {
        description:
          "Test article containing all legacy social media block variations using the old blockType structure (twitterEmbed, youtubeEmbed, etc.).",
        image: mediaDocs[0]?.id ?? undefined,
      },
    },
    {
      skipSocialEmbedSnapshot: true,
    },
  )

  return article.id
}
