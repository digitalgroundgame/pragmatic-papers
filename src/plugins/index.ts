import { revalidateRedirects } from "@/hooks/revalidateRedirects"
import type { Article, Page, Topic, Volume } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { toRoman } from "@/utilities/toRoman"
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder"
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs"
import { redirectsPlugin } from "@payloadcms/plugin-redirects"
import { searchPlugin } from "@payloadcms/plugin-search"
import type { BeforeSync } from "@payloadcms/plugin-search/types"
import { seoPlugin } from "@payloadcms/plugin-seo"
import { type GenerateTitle, type GenerateURL } from "@payloadcms/plugin-seo/types"
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from "@payloadcms/richtext-lexical"
import { s3Storage } from "@payloadcms/storage-s3"
import { type Plugin } from "payload"

function isVolume(obj: Volume | Article | Page | Topic): obj is Volume {
  return (obj as Volume).volumeNumber !== undefined
}

interface LexicalTextNode {
  type?: string
  text?: string
  children?: LexicalTextNode[]
}

function lexicalToPlainText(node: LexicalTextNode | undefined | null): string {
  if (!node) return ""
  if (typeof node.text === "string") return node.text
  if (!Array.isArray(node.children)) return ""
  return node.children.map(lexicalToPlainText).join(" ")
}

export const generateTitle: GenerateTitle<Volume | Article | Page | Topic> = ({ doc }) => {
  if (isVolume(doc)) {
    return doc?.volumeNumber
      ? `Volume ${toRoman(doc.volumeNumber)} | The Pragmatic Papers`
      : "The Pragmatic Papers"
  }
  if ("name" in doc && doc.name) return `${doc.name} | The Pragmatic Papers`
  if ("title" in doc && doc.title) return `${doc.title} | The Pragmatic Papers`
  return "The Pragmatic Papers"
}

const generateURL: GenerateURL<Volume | Article | Page | Topic> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

const beforeSync: BeforeSync = ({ originalDoc, searchDoc }) => {
  const title =
    (originalDoc.title as string | undefined) || (originalDoc.name as string | undefined) || ""
  const meta = originalDoc.meta as Record<string, unknown> | undefined
  const excerpt =
    (meta?.description as string | undefined) ||
    (originalDoc.description as string | undefined) ||
    ""
  const slug = (originalDoc.slug as string | undefined) || ""

  const populatedAuthors = originalDoc.populatedAuthors as
    | { name?: string | null }[]
    | undefined
    | null
  const authors = populatedAuthors
    ? populatedAuthors
        .map((a) => a.name)
        .filter(Boolean)
        .join(", ")
    : ""

  const topicsRaw = originalDoc.topics as ({ name?: string | null } | number)[] | undefined | null
  const topics = Array.isArray(topicsRaw)
    ? topicsRaw
        .map((t) => (typeof t === "object" && t !== null ? t.name : null))
        .filter(Boolean)
        .join(", ")
    : ""

  // Prefer heroImage, fall back to meta image, then profileImage (users)
  const image =
    (originalDoc.heroImage as number | null | undefined) ??
    ((originalDoc.meta as Record<string, unknown> | undefined)?.image as
      | number
      | null
      | undefined) ??
    (originalDoc.profileImage as number | null | undefined) ??
    null

  const content = originalDoc.content as { root?: LexicalTextNode } | undefined
  const body = lexicalToPlainText(content?.root).replace(/\s+/g, " ").trim().slice(0, 39000)

  return { ...searchDoc, title, excerpt, slug, authors, topics, image, body }
}

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
  seoPlugin({
    generateTitle,
    generateURL,
  }),
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
        generateFileURL: ({ filename }) => {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const bucket = process.env.S3_BUCKET

          if (!supabaseUrl || !bucket) {
            // Fallback to local media path if env vars are not set
            return `/media/${filename}`
          }

          return `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`
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
