import type { PluginSwitchName } from "@/globals/Plugins/isPluginEnabled"
import { admin, editor } from "@/access/collections"
import { isStaff } from "@/access/roles"
import { revalidateRedirects } from "@/hooks/revalidateRedirects"
import { docsPlugin } from "@/plugins/docs"
import { docsNotifications } from "@/plugins/docs/notifications"
import { notificationsPlugin } from "@/plugins/notifications"
import { toursPlugin } from "@/plugins/tours"
import type { Article, Interactive, Page, Topic, User, Volume } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"
import { DEFAULT_DESCRIPTION } from "@/utilities/mergeOpenGraph"
import { docPath } from "@/utilities/routes"
import { describePlugin } from "@/utilities/registerPlugin"
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

import { achievementsPlugin } from "./achievements"
import { commentsPlugin } from "./comments"
import { achievementsOptions, readerAchievements } from "./readerAchievements"
import { commentsOn, signUpProviders, ssoOptions } from "./signIn"
import { getSignedInUser, ssoPlugin } from "./sso"
import { staffByDefault } from "./staffByDefault"

// Reads the plugin's switch on System → Plugins when called. Imported then, not here: the
// Plugins global reaches the Payload config, which imports this file.
const pluginSwitch = (name: PluginSwitchName) => async (): Promise<boolean> =>
  (await import("@/globals/Plugins/isPluginEnabled")).isPluginEnabled(name)

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

/**
 * The site's Payload plugins, in the order they run. Ours describe themselves for System →
 * Plugins (`registerPlugin`); the packages don't yet, so they're described here (`describePlugin`).
 */
export const plugins: Plugin[] = [
  describePlugin(
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
    {
      slug: "plugin-search",
      manifest: {
        name: "Search",
        source: "@payloadcms/plugin-search",
        description:
          "Keeps a search index of articles, pages, volumes and topics, which the site's search reads.",
      },
    },
  ),
  describePlugin(
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
    {
      slug: "plugin-redirects",
      manifest: {
        name: "Redirects",
        source: "@payloadcms/plugin-redirects",
        description:
          "Redirects from old URLs to pages, volumes and articles. Hidden in the admin until it's set up.",
      },
    },
  ),
  describePlugin(
    nestedDocsPlugin({
      collections: ["categories"],
      generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ""),
    }),
    {
      slug: "plugin-nested-docs",
      manifest: {
        name: "Nested docs",
        source: "@payloadcms/plugin-nested-docs",
        description: "Parents and breadcrumb URLs for categories.",
      },
    },
  ),
  describePlugin(seo, {
    slug: "plugin-seo",
    manifest: {
      name: "SEO",
      source: "@payloadcms/plugin-seo",
      description:
        "The Auto-generate buttons in the SEO tab of articles, pages, volumes, topics and interactives.",
    },
  }),
  describePlugin(
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
        // The plugin lets any logged-in user read every submission.
        access: { read: editor },
        admin: {
          hidden: true, // TODO: Setup form builder plugin
        },
      },
    }),
    {
      slug: "plugin-form-builder",
      manifest: {
        name: "Form builder",
        source: "@payloadcms/plugin-form-builder",
        description: "Forms and their submissions. Hidden in the admin until it's set up.",
      },
    },
  ),
  describePlugin(
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
    {
      slug: "storage-s3",
      manifest: {
        name: "S3 storage",
        source: "@payloadcms/storage-s3",
        description:
          "Keeps media and map uploads in the S3 bucket. Off where USE_LOCAL_STORAGE=true, which keeps them on disk.",
      },
      enabled: process.env.USE_LOCAL_STORAGE !== "true",
    },
  ),
  docsPlugin({ enabled: pluginSwitch("docs") }),
  notificationsPlugin({
    sources: [docsNotifications({ enabled: pluginSwitch("docs"), tours: pluginSwitch("tours") })],
    enabled: pluginSwitch("notifications"),
  }),
  toursPlugin({ enabled: pluginSwitch("tours") }),
  ssoPlugin(ssoOptions),
  commentsPlugin({
    // Read from the database on each request, like `sso`'s, so switching either off stops
    // posts at once.
    enabled: commentsOn,
    // Members and staff alike: a member is signed in to the site but not to Payload.
    currentUser: (req) => getSignedInUser(req, ssoOptions),
    // `emailVerified` and `roles` are what readers' achievements are worked out from.
    authorFields: ["name", "avatarUrl", "roles", "emailVerified"],
    // Staff addresses are the ones an admin gave them.
    isVerified: (author) => author.emailVerified === true || isStaff(author as unknown as User),
    describeAuthor: (author) => ({
      name: typeof author.name === "string" && author.name ? author.name : "Anonymous",
      image: typeof author.avatarUrl === "string" ? author.avatarUrl : null,
      badge: isStaff(author as unknown as User) ? "Staff" : null,
    }),
    // A reader's highest achievement badge, when Staff doesn't apply. None while achievements are off.
    authorBadges: (authors, req) => readerAchievements.badgesFor(authors, req),
    signInProviders: signUpProviders,
    baseURL: getSiteURL,
    moderators: editor,
    admins: admin,
  }),
  achievementsPlugin(achievementsOptions),
  // Last, so it sees every other plugin's collections.
  describePlugin(staffByDefault, {
    slug: "staff-by-default",
    manifest: {
      name: "Staff by default",
      source: "src/plugins/staffByDefault.ts",
      description:
        "Gives every access rule a collection or plugin leaves unset to staff, where Payload's default is anyone signed in, so members never get more than readers.",
    },
  }),
]
