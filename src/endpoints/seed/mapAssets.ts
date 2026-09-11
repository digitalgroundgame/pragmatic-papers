import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { File, Payload } from "payload"

import type { MapAsset } from "@/payload-types"

const fixturesDir = path.dirname(fileURLToPath(import.meta.url)) + "/fixtures"

/**
 * Uploads a fixture SVG into the `map-assets` collection. Used by the seeder so
 * the InteractiveMap demo article references real, processable Media docs the
 * same way an editor would after a real upload from the admin.
 */
export async function createMapAssetFromFixture(
  payload: Payload,
  fixtureFilename: string,
  label: string,
  sourceUrl?: string,
): Promise<MapAsset> {
  const data = await readFile(path.join(fixturesDir, fixtureFilename))
  // Run-unique filename so re-seeding doesn't trip Payload's filename-increment path. Fixtures
  // may live in a subdirectory; only the basename becomes the upload's filename.
  const file: File = {
    name: `${Date.now()}-${path.basename(fixtureFilename)}`,
    data,
    mimetype: "image/svg+xml",
    size: data.byteLength,
  }
  return payload.create({
    collection: "map-assets",
    data: {
      label,
      source: sourceUrl ? { type: "custom", url: sourceUrl } : undefined,
    },
    file,
  })
}
