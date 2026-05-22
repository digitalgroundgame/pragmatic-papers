import type { Payload } from "payload"
import { findMediaReferencesInLexicalContent } from "@/utilities/lexicalMediaReferences"

export interface MediaReference {
  collection: string
  field: string
  docId: number | string
  docTitle: string
  docSlug?: string
}

export async function collectMediaReferences(
  payload: Payload,
  mediaId: number | string,
): Promise<MediaReference[]> {
  const refs: MediaReference[] = []

  const articles = await payload.find({
    collection: "articles",
    depth: 0,
    select: { title: true, slug: true, heroImage: true, narration: true, meta: true },
    where: {
      and: [
        { _status: { equals: "published" } },
        {
          or: [
            { heroImage: { equals: mediaId } },
            { narration: { equals: mediaId } },
            { "meta.image": { equals: mediaId } },
          ],
        },
      ],
    },
    overrideAccess: true,
  })

  for (const article of articles.docs) {
    const title = article.title || "Untitled"
    if (String((article as Record<string, unknown>).heroImage) === String(mediaId)) {
      refs.push({
        collection: "articles",
        field: "heroImage",
        docId: article.id,
        docTitle: title,
        docSlug: article.slug ?? undefined,
      })
    }
    if (String((article as Record<string, unknown>).narration) === String(mediaId)) {
      refs.push({
        collection: "articles",
        field: "narration",
        docId: article.id,
        docTitle: title,
        docSlug: article.slug ?? undefined,
      })
    }
    const meta = (article as Record<string, unknown>).meta as Record<string, unknown> | undefined
    if (meta && String(meta.image) === String(mediaId)) {
      refs.push({
        collection: "articles",
        field: "meta.image",
        docId: article.id,
        docTitle: title,
        docSlug: article.slug ?? undefined,
      })
    }
  }

  const articlesContent = await payload.find({
    collection: "articles",
    depth: 0,
    select: { title: true, slug: true, content: true },
    where: { _status: { equals: "published" } },
    limit: 500,
    overrideAccess: true,
  })

  for (const article of articlesContent.docs) {
    const content = (article as Record<string, unknown>).content
    if (content && typeof content === "object") {
      const found = findMediaReferencesInLexicalContent(content, mediaId)
      if (found.length > 0) {
        const fieldDesc = found.map((f) => f.blockType).join(", ")
        refs.push({
          collection: "articles",
          field: `content (${fieldDesc})`,
          docId: article.id,
          docTitle: article.title || "Untitled",
          docSlug: article.slug ?? undefined,
        })
      }
    }
  }

  const pages = await payload.find({
    collection: "pages",
    depth: 0,
    select: { title: true, slug: true, hero: true, meta: true },
    where: {
      and: [
        { _status: { equals: "published" } },
        {
          or: [{ "hero.media": { equals: mediaId } }, { "meta.image": { equals: mediaId } }],
        },
      ],
    },
    overrideAccess: true,
  })

  for (const page of pages.docs) {
    const title = page.title || "Untitled"
    const hero = (page as Record<string, unknown>).hero as Record<string, unknown> | undefined
    if (hero && String(hero.media) === String(mediaId)) {
      refs.push({
        collection: "pages",
        field: "hero.media",
        docId: page.id,
        docTitle: title,
        docSlug: page.slug ?? undefined,
      })
    }
    const meta = (page as Record<string, unknown>).meta as Record<string, unknown> | undefined
    if (meta && String(meta.image) === String(mediaId)) {
      refs.push({
        collection: "pages",
        field: "meta.image",
        docId: page.id,
        docTitle: title,
        docSlug: page.slug ?? undefined,
      })
    }
  }

  const pagesLayout = await payload.find({
    collection: "pages",
    depth: 0,
    select: { title: true, slug: true, layout: true },
    where: { _status: { equals: "published" } },
    limit: 500,
    overrideAccess: true,
  })

  for (const page of pagesLayout.docs) {
    const layout = (page as Record<string, unknown>).layout as
      | Array<Record<string, unknown>>
      | undefined
    if (Array.isArray(layout)) {
      for (const block of layout) {
        if (block.blockType === "mediaBlock" && String(block.media) === String(mediaId)) {
          refs.push({
            collection: "pages",
            field: "layout (mediaBlock)",
            docId: page.id,
            docTitle: page.title || "Untitled",
            docSlug: page.slug ?? undefined,
          })
        }
      }
    }
  }

  const volumes = await payload.find({
    collection: "volumes",
    depth: 0,
    select: { title: true, slug: true, meta: true },
    where: {
      and: [{ _status: { equals: "published" } }, { "meta.image": { equals: mediaId } }],
    },
    overrideAccess: true,
  })

  for (const volume of volumes.docs) {
    const title = volume.title || "Untitled"
    refs.push({
      collection: "volumes",
      field: "meta.image",
      docId: volume.id,
      docTitle: title,
      docSlug: volume.slug ?? undefined,
    })
  }

  const volumesNote = await payload.find({
    collection: "volumes",
    depth: 0,
    select: { title: true, slug: true, editorsNote: true },
    where: { _status: { equals: "published" } },
    limit: 500,
    overrideAccess: true,
  })

  for (const volume of volumesNote.docs) {
    const editorsNote = (volume as Record<string, unknown>).editorsNote
    if (editorsNote && typeof editorsNote === "object") {
      const found = findMediaReferencesInLexicalContent(editorsNote, mediaId)
      if (found.length > 0) {
        refs.push({
          collection: "volumes",
          field: "editorsNote (mediaBlock)",
          docId: volume.id,
          docTitle: volume.title || "Untitled",
          docSlug: volume.slug ?? undefined,
        })
      }
    }
  }

  const topics = await payload.find({
    collection: "topics",
    depth: 0,
    select: { name: true, slug: true },
    where: { "meta.image": { equals: mediaId } },
    overrideAccess: true,
  })

  for (const topic of topics.docs) {
    refs.push({
      collection: "topics",
      field: "meta.image",
      docId: topic.id,
      docTitle: topic.name || "Untitled",
      docSlug: topic.slug ?? undefined,
    })
  }

  const users = await payload.find({
    collection: "users",
    depth: 0,
    select: { name: true },
    where: { profileImage: { equals: mediaId } },
    overrideAccess: true,
  })

  for (const user of users.docs) {
    refs.push({
      collection: "users",
      field: "profileImage",
      docId: user.id,
      docTitle: user.name || "Unknown user",
    })
  }

  return refs
}
