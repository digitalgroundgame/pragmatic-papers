import { revalidateRedirects } from "@/hooks/revalidateRedirects"
import type { Article, Interactive, Page, Topic, Volume } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"
import { DEFAULT_DESCRIPTION } from "@/utilities/mergeOpenGraph"
import { docPath } from "@/utilities/routes"
import { truncate } from "@/utilities/truncate"
import { toRoman } from "@/utilities/toRoman"
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder"
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs"
import { redirectsPlugin } from "@payloadcms/plugin-redirects"
import { searchPlugin } from "@payloadcms/plugin-search"
import type { BeforeSync } from "@payloadcms/plugin-search/types"
import { seoPlugin } from "@payloadcms/plugin-seo"
import {
  type GenerateDescription,
  type GenerateTitle,
  type GenerateURL,
} from "@payloadcms/plugin-seo/types"
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from "@payloadcms/richtext-lexical"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext"
import { s3Storage } from "@payloadcms/storage-s3"
import { type Payload, type Plugin } from "payload"

type SeoDoc = Volume | Article | Page | Topic | Interactive

function isVolume(obj: SeoDoc): obj is Volume {
  return (obj as Volume).volumeNumber !== undefined
}

export const generateTitle: GenerateTitle<SeoDoc> = ({ doc }) => {
  if (isVolume(doc)) {
    return doc?.volumeNumber
      ? `Volume ${toRoman(doc.volumeNumber)} | The Pragmatic Papers`
      : "The Pragmatic Papers"
  }
  if ("name" in doc && doc.name) return `${doc.name} | The Pragmatic Papers`
  if ("title" in doc && doc.title) return `${doc.title} | The Pragmatic Papers`
  return "The Pragmatic Papers"
}

const DESCRIPTION_LENGTH = 160

export const generateDescription: GenerateDescription<SeoDoc> = ({ doc }) => {
  if ("description" in doc && doc.description) return doc.description
  // Interactives have no description field; their standfirst says what the page is.
  if ("intro" in doc && doc.intro) {
    const intro = convertLexicalToPlaintext({ data: doc.intro }).replace(/\s+/g, " ").trim()
    if (intro.length > DESCRIPTION_LENGTH) {
      return truncate(intro, DESCRIPTION_LENGTH - 1, { atWord: true })
    }
    if (intro) return intro
  }
  return DEFAULT_DESCRIPTION
}

export const generateURL: GenerateURL<SeoDoc> = ({ collectionConfig, doc }) => {
  const url = getSiteURL()
  if (!doc?.slug) return url

  const path = docPath(collectionConfig?.slug ?? "pages", doc.slug)
  return path === "/" ? url : `${url}${path}`
}

/**
 * Joins the names of a document's `users` or `topics` relationship for the search index.
 *
 * The reindex handler fetches documents at `depth: 0`, so the relationship arrives as bare
 * IDs. Articles used to paper over that with `populateAuthors` and `populateTopics`
 * afterRead hooks, which ran on *every* article read, one query per article, just so this
 * one caller could see names. Resolving here keeps it at the call site that needs it, in
 * one batched query.
 */
async function resolveNames(
  raw: unknown,
  payload: Payload,
  collection: "users" | "topics",
): Promise<string> {
  if (!Array.isArray(raw) || !raw.length) return ""

  const names = new Map<number, string | null | undefined>()
  const unresolvedIds: number[] = []

  for (const item of raw) {
    if (typeof item === "number") {
      unresolvedIds.push(item)
    } else if (item && typeof item === "object") {
      names.set(item.id, item.name)
    }
  }

  if (unresolvedIds.length) {
    try {
      const { docs } = await payload.find({
        collection,
        where: { id: { in: unresolvedIds } },
        depth: 0,
        limit: unresolvedIds.length,
        select: { name: true },
        overrideAccess: true,
      })
      for (const doc of docs) names.set(doc.id, doc.name)
    } catch (error) {
      payload.logger.error(
        { err: error, collection, unresolvedIds },
        `Failed to resolve ${collection} names for search`,
      )
    }
  }

  return raw
    .map((item) => (typeof item === "number" ? names.get(item) : item?.name))
    .filter(Boolean)
    .join(", ")
}

export const resolveAuthorNames = (raw: unknown, payload: Payload): Promise<string> =>
  resolveNames(raw, payload, "users")

export const resolveTopicNames = (raw: unknown, payload: Payload): Promise<string> =>
  resolveNames(raw, payload, "topics")

const beforeSync: BeforeSync = async ({ originalDoc, payload, searchDoc }) => {
  const title =
    (originalDoc.title as string | undefined) || (originalDoc.name as string | undefined) || ""
  const meta = originalDoc.meta as Record<string, unknown> | undefined
  const excerpt =
    (meta?.description as string | undefined) ||
    (originalDoc.description as string | undefined) ||
    ""
  const slug = (originalDoc.slug as string | undefined) || ""

  const authors = await resolveAuthorNames(originalDoc.authors, payload)
  const topics = await resolveTopicNames(originalDoc.topics, payload)

  // Prefer heroImage, fall back to meta image, then profileImage (users)
  const image =
    (originalDoc.heroImage as number | null | undefined) ??
    ((originalDoc.meta as Record<string, unknown> | undefined)?.image as
      number | null | undefined) ??
    (originalDoc.profileImage as number | null | undefined) ??
    null

  const content = originalDoc.content as SerializedEditorState | undefined
  const body = content
    ? convertLexicalToPlaintext({ data: content }).replace(/\s+/g, " ").trim().slice(0, 39000)
    : ""

  return { ...searchDoc, title, excerpt, slug, authors, topics, image, body }
}

// The collections build their own SEO tab, so keep them as they are. The
// plugin still needs them listed: its generate endpoints refuse any other.
// Drop this wrapper once plugin-seo can authorize without injecting fields:
// https://github.com/payloadcms/payload/issues/18311
const seo: Plugin = async (config) => ({
  ...(await seoPlugin({
    collections: ["articles", "pages", "volumes", "topics", "interactives"],
    generateTitle,
    generateDescription,
    generateURL,
  })(config)),
  collections: config.collections,
})

/**
 * The public URL of an object in a Supabase bucket. `prefix` is the object's folder as the
 * storage plugin passes it to `generateFileURL`: the collection's prefix joined with the
 * `_objectKey` folder each client upload is stored under. Media uploaded before Payload 3.90
 * has no `_objectKey`, so its folder is just the prefix.
 */
export const supabaseObjectURL = ({
  supabaseUrl,
  bucket,
  prefix,
  filename,
}: {
  supabaseUrl: string
  bucket: string
  prefix?: string
  filename: string
}): string =>
  `${supabaseUrl}/storage/v1/object/public/${bucket}/${prefix ? `${prefix}/` : ""}${filename}`

export const plugins: Plugin[] = [
  searchPlugin({
    collections: ["articles", "pages", "volumes", "topics"],
    defaultPriorities: {
      articles: 40,
      volumes: 30,
      pages: 20,
      topics: 10,
    },
    beforeSync,
    searchOverrides: {
      labels: { singular: "Search Result", plural: "Search" },
      admin: { group: "System" },
      fields: ({ defaultFields }) => [
        ...defaultFields,
        { name: "excerpt", type: "text", admin: { readOnly: true } },
        { name: "slug", type: "text", admin: { readOnly: true } },
        { name: "authors", type: "text", admin: { readOnly: true } },
        { name: "topics", type: "text", admin: { readOnly: true } },
        { name: "image", type: "upload", relationTo: "media", admin: { readOnly: true } },
        { name: "body", type: "textarea", admin: { readOnly: true, hidden: true } },
      ],
    },
  }),
  redirectsPlugin({
    collections: ["pages", "volumes", "articles"],
    overrides: {
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ("name" in field && field.name === "from") {
            return {
              ...field,
              admin: {
                description: "You will need to rebuild the website when changing this field.",
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
      admin: {
        hidden: true, // TODO: Setup redirects plugin
      },
    },
  }),
  nestedDocsPlugin({
    collections: ["categories"],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ""),
  }),
  seo,
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ("name" in field && field.name === "confirmationMessage") {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ["h1", "h2", "h3", "h4"] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
      admin: {
        hidden: true, // TODO: Setup form builder plugin
      },
    },
    formSubmissionOverrides: {
      admin: {
        hidden: true, // TODO: Setup form builder plugin
      },
    },
  }),
  s3Storage({
    // Enable S3 storage only when not using local storage
    // For staging/preview: set USE_LOCAL_STORAGE=true to use local file system
    // For production: set USE_LOCAL_STORAGE=false (or leave unset) to use S3
    enabled: process.env.USE_LOCAL_STORAGE !== "true",
    collections: {
      media: {
        disablePayloadAccessControl: true,
        generateFileURL: ({ filename, prefix }) => {
          const supabaseUrl = process.env.SUPABASE_URL
          const bucket = process.env.S3_BUCKET

          if (!supabaseUrl || !bucket) {
            // Fallback to local media path if env vars are not set
            return `/media/${filename}`
          }

          return supabaseObjectURL({ supabaseUrl, bucket, prefix, filename })
        },
      },
      "map-assets": {
        disablePayloadAccessControl: true,
        prefix: "map-assets",
        generateFileURL: ({ filename, prefix }) => {
          const supabaseUrl = process.env.SUPABASE_URL
          const bucket = process.env.S3_BUCKET

          if (!supabaseUrl || !bucket) {
            return `/map-assets/${filename}`
          }

          return supabaseObjectURL({
            supabaseUrl,
            bucket,
            prefix: prefix || "map-assets",
            filename,
          })
        },
      },
    },
    bucket: process.env.S3_BUCKET || "",
    config: {
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || "",
    },
    clientUploads: true,
  }),
]
