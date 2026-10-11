import { installedPlugin, type PluginLink } from "@/globals/Plugins/installedPlugin"
import type { Experiment } from "@/globals/SiteSettings/isExperimentEnabled"
import { revalidateRedirects } from "@/hooks/revalidateRedirects"
import { docsPlugin } from "@/plugins/docs"
import { docsNotifications } from "@/plugins/docs/notifications"
import { notificationsPlugin } from "@/plugins/notifications"
import { toursPlugin } from "@/plugins/tours"
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

// Reads the switch in Site Settings when called. Imported then, not here: the
// Settings global reaches the Payload config, which imports this file.
const experiment = (name: Experiment) => async (): Promise<boolean> =>
  (await import("@/globals/SiteSettings/isExperimentEnabled")).isExperimentEnabled(name)

const EXPERIMENTS: PluginLink = { label: "Settings → Experiments", path: "/globals/site-settings" }

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

export const beforeSync: BeforeSync = async ({ originalDoc, payload, searchDoc }) => {
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

/**
 * A storage collection's `generateFileURL`: the object's Supabase URL, or `/<localPath>/<filename>`
 * when `SUPABASE_URL` or `S3_BUCKET` is unset. `defaultPrefix` stands in for a missing prefix.
 */
export const storageFileURL =
  (localPath: string, defaultPrefix?: string) =>
  ({ filename, prefix }: { filename: string; prefix?: string }): string => {
    const supabaseUrl = process.env.SUPABASE_URL
    const bucket = process.env.S3_BUCKET
    if (!supabaseUrl || !bucket) return `/${localPath}/${filename}`
    return supabaseObjectURL({ supabaseUrl, bucket, prefix: prefix || defaultPrefix, filename })
  }

export const plugins: Plugin[] = [
  installedPlugin(
    {
      name: "Search",
      source: "@payloadcms/plugin-search",
      description:
        "Keeps a search index of articles, pages, volumes and topics, which the site's search reads.",
    },
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
  ),
  installedPlugin(
    {
      name: "Redirects",
      source: "@payloadcms/plugin-redirects",
      description:
        "Redirects from old URLs to pages, volumes and articles. Hidden in the admin until it's set up.",
    },
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
  ),
  installedPlugin(
    {
      name: "Nested docs",
      source: "@payloadcms/plugin-nested-docs",
      description: "Parents and breadcrumb URLs for categories.",
    },
    nestedDocsPlugin({
      collections: ["categories"],
      generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ""),
    }),
  ),
  installedPlugin(
    {
      name: "SEO",
      source: "@payloadcms/plugin-seo",
      description:
        "The Auto-generate buttons in the SEO tab of articles, pages, volumes, topics and interactives.",
    },
    seo,
  ),
  installedPlugin(
    {
      name: "Form builder",
      source: "@payloadcms/plugin-form-builder",
      description: "Forms and their submissions. Hidden in the admin until it's set up.",
    },
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
  ),
  installedPlugin(
    {
      name: "S3 storage",
      source: "@payloadcms/storage-s3",
      description:
        "Keeps media and map uploads in the S3 bucket. Off where USE_LOCAL_STORAGE=true, which keeps them on disk.",
      enabled: process.env.USE_LOCAL_STORAGE !== "true",
    },
    s3Storage({
      // Enable S3 storage only when not using local storage
      // For staging/preview: set USE_LOCAL_STORAGE=true to use local file system
      // For production: set USE_LOCAL_STORAGE=false (or leave unset) to use S3
      enabled: process.env.USE_LOCAL_STORAGE !== "true",
      collections: {
        media: {
          disablePayloadAccessControl: true,
          generateFileURL: storageFileURL("media"),
        },
        "map-assets": {
          disablePayloadAccessControl: true,
          prefix: "map-assets",
          generateFileURL: storageFileURL("map-assets", "map-assets"),
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
  ),
  installedPlugin(
    {
      name: "Help docs",
      source: "src/plugins/docs",
      description:
        "Help docs at /docs, written in the admin or shipped in src/docs/ with a release.",
      enabled: experiment("docs"),
      settings: [EXPERIMENTS],
    },
    docsPlugin(),
  ),
  installedPlugin(
    {
      name: "Notifications",
      source: "src/plugins/notifications",
      description:
        "The bell beside the avatar in the admin header: help docs and other news for each staff member.",
      enabled: experiment("notifications"),
      settings: [EXPERIMENTS],
    },
    notificationsPlugin({
      sources: [docsNotifications({ enabled: experiment("docs"), tours: experiment("tours") })],
      enabled: experiment("notifications"),
    }),
  ),
  installedPlugin(
    {
      name: "Guided tours",
      source: "src/plugins/tours",
      description:
        "driver.js walkthroughs of the admin, started from a help doc or the bell's Show me.",
      enabled: experiment("tours"),
      settings: [EXPERIMENTS],
    },
    toursPlugin({ enabled: experiment("tours") }),
  ),
]
