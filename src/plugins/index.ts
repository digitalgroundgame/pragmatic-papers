import { revalidateRedirects } from "@/hooks/revalidateRedirects"
import type { Article, Page, Topic, Volume } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { toRoman } from "@/utilities/toRoman"
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder"
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs"
import { redirectsPlugin } from "@payloadcms/plugin-redirects"
import { searchPlugin } from "@payloadcms/plugin-search"
import { seoPlugin } from "@payloadcms/plugin-seo"
import { type GenerateTitle, type GenerateURL } from "@payloadcms/plugin-seo/types"
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from "@payloadcms/richtext-lexical"
import { s3Storage } from "@payloadcms/storage-s3"
import { type Plugin } from "payload"

function isVolume(obj: Volume | Article | Page | Topic): obj is Volume {
  return (obj as Volume).volumeNumber !== undefined
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

const beforeSync: NonNullable<Parameters<typeof searchPlugin>[0]["beforeSync"]> = ({
  originalDoc,
  searchDoc,
}) => {
  const title =
    (originalDoc.title as string | undefined) || (originalDoc.name as string | undefined) || ""
  const meta = originalDoc.meta as Record<string, unknown> | undefined
  const excerpt =
    (meta?.description as string | undefined) ||
    (originalDoc.description as string | undefined) ||
    ""
  const slug = (originalDoc.slug as string | undefined) || ""

  return { ...searchDoc, title, excerpt, slug }
}

export const plugins: Plugin[] = [
  searchPlugin({
    collections: ["articles", "pages", "volumes", "topics"],
    beforeSync,
    searchOverrides: {
      fields: ({ defaultFields }) => [
        ...defaultFields,
        { name: "excerpt", type: "text", admin: { readOnly: true } },
        { name: "slug", type: "text", admin: { readOnly: true } },
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
