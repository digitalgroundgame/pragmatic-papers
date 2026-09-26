import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"
import { seed } from "@/endpoints/seed"
import { getPayload } from "./helpers/testUsers"
import { MINIMAL_PNG } from "./fixtures/media"

// A header-only PCM WAV with no samples; the narration field only accepts
// media whose sniffed mimeType is audio.
function emptyWav(): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.alloc(44)
  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36, 4)
  buffer.write("WAVEfmt ", 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(8000, 24)
  buffer.writeUInt32LE(16000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write("data", 36)
  buffer.writeUInt32LE(0, 40)
  return new Uint8Array(buffer)
}

// Runs the real seed the way `pnpm dev:db-seed` does: outside a Next.js
// request, so any revalidatePath/revalidateTag that slips past
// `disableRevalidate` throws here.
describe("seed outside Next.js", () => {
  let payload: Payload
  const context = { disableRevalidate: true }

  const count = async (collection: "articles" | "volumes" | "pages" | "users") =>
    (await payload.count({ collection })).totalDocs

  beforeAll(async () => {
    payload = await getPayload()
    // Keeps the test off the network: remote images become one tiny PNG and
    // the narration audio an empty WAV.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith(".mp3")
          ? new Response(emptyWav(), { status: 200 })
          : new Response(new Uint8Array(MINIMAL_PNG), { status: 200 }),
      ),
    )
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it("seeds an empty database", async () => {
    await seed(payload, undefined, context)

    expect(await count("articles")).toBeGreaterThan(0)
    expect(await count("volumes")).toBe(4)
    const home = await payload.find({ collection: "pages", where: { slug: { equals: "home" } } })
    expect(home.docs).toHaveLength(1)
    const header = await payload.findGlobal({ slug: "header" })
    expect(header.navItems?.length).toBeGreaterThan(0)
    const recommendations = await payload.findGlobal({ slug: "article-recommendations" })
    expect(recommendations.rankings?.length).toBeGreaterThan(0)
  }, 300_000)

  it("re-seeds over its own data, ranked articles included", async () => {
    const before = {
      articles: await count("articles"),
      volumes: await count("volumes"),
      pages: await count("pages"),
      users: await count("users"),
    }

    await seed(payload, undefined, context)

    expect({
      articles: await count("articles"),
      volumes: await count("volumes"),
      pages: await count("pages"),
      users: await count("users"),
    }).toEqual(before)
  }, 300_000)
})
