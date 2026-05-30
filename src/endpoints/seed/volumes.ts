import type { Media, Volume } from "@/payload-types"
import type { Payload, RequiredDataFromCollectionSlug } from "payload"
import { createRichTextFromString } from "./richtext"

interface VolumeConfig {
  volumeNumber: number
  title: string
  description: string
  editorsNoteContent: string
  articleIds: number[]
}

interface CreateVolumesResult {
  volumes: Volume[]
}

type VolumeData = RequiredDataFromCollectionSlug<"volumes">

async function createOrUpdateVolume(payload: Payload, data: VolumeData): Promise<Volume> {
  const maxAttempts = 3
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isLastAttempt = attempt === maxAttempts

    try {
      if (isLastAttempt) {
        // Minimal-fields fallback: strip relationships and rich text
        const { title, volumeNumber, description, slug, _status, publishedAt } = data
        return await payload.create({
          collection: "volumes",
          data: { title, volumeNumber, description, slug, _status, publishedAt },
        })
      }

      return await payload.create({ collection: "volumes", data })
    } catch (err) {
      lastError = err
      const message = err instanceof Error ? err.message : String(err)
      const isSlugConflict = message.toLowerCase().includes("slug")

      if (isSlugConflict) {
        const existing = await payload.find({
          collection: "volumes",
          where: { slug: { equals: data.slug } },
          limit: 1,
        })

        const existingVolume = existing.docs[0]
        if (!existingVolume) throw err

        payload.logger.warn(
          `Volume slug "${data.slug}" already exists (id: ${existingVolume.id}), updating instead of creating.`,
        )

        return await payload.update({ collection: "volumes", id: existingVolume.id, data })
      }

      if (isLastAttempt) {
        payload.logger.warn(
          `Volume create attempt ${attempt}/${maxAttempts} (minimal fields) failed for "${data.slug}". Error: ${message}`,
        )
      } else {
        payload.logger.warn(
          `Volume create attempt ${attempt}/${maxAttempts} failed for "${data.slug}", retrying. Error: ${message}`,
        )
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      }
    }
  }

  throw new Error(`Failed to create volume "${data.slug}" after ${maxAttempts} attempts`, {
    cause: lastError,
  })
}

export const createVolumes = async (
  payload: Payload,
  volumeConfigs: VolumeConfig[],
  mediaDocs: Media[],
): Promise<CreateVolumesResult> => {
  const volumes: Volume[] = []

  for (const config of volumeConfigs) {
    const mediaDoc = mediaDocs[config.volumeNumber % mediaDocs.length]
    const volume = await createOrUpdateVolume(payload, {
      title: config.title,
      volumeNumber: config.volumeNumber,
      description: config.description,
      editorsNote: createRichTextFromString(config.editorsNoteContent),
      articles: config.articleIds,
      slug: config.volumeNumber.toString(),
      _status: "published",
      publishedAt: new Date().toISOString(),
      meta: {
        title: config.title,
        description: config.description,
        image: mediaDoc?.id ?? null,
      },
    })
    volumes.push(volume)
  }

  return { volumes }
}
