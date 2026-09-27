import { randomUUID } from "node:crypto"
import config from "@payload-config"
import { handleEndpoints, type Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import { DEFAULT_DESCRIPTION } from "@/utilities/mergeOpenGraph"
import { createUser, getPayload } from "./helpers/testUsers"

let payload: Payload
let token: string

beforeAll(async () => {
  payload = await getPayload()
  const admin = await createUser("admin")
  const login = await payload.login({
    collection: "users",
    data: { email: admin.email, password: "test-password" },
  })
  token = login.token!
})

const generate = async (field: "title" | "description", body: Record<string, unknown>) => {
  const response = await handleEndpoints({
    config,
    request: new Request(`http://localhost/api/plugin-seo/generate-${field}`, {
      method: "POST",
      headers: { Authorization: `JWT ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  })
  return { status: response.status, ...((await response.json()) as { result?: string }) }
}

describe("SEO generate endpoints", () => {
  it.each(["articles", "pages", "volumes", "topics"] as const)(
    "leaves %s with only its own SEO fields",
    (slug) => {
      const meta = payload.collections[slug].config.flattenedFields.filter(
        (field) => field.name === "meta",
      )
      expect(meta).toHaveLength(1)
    },
  )

  it("generates a title and description from a saved topic", async () => {
    const topic = await payload.create({
      collection: "topics",
      draft: true,
      data: { name: `Economics ${randomUUID().slice(0, 8)}`, description: "Markets and money." },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    const body = { id: topic.id, collectionSlug: "topics", doc: topic }

    expect(await generate("title", body)).toEqual({
      status: 200,
      result: `${topic.name} | The Pragmatic Papers`,
    })
    expect(await generate("description", body)).toEqual({
      status: 200,
      result: "Markets and money.",
    })
  })

  it.each(["articles", "pages", "volumes"])("accepts an unsaved %s doc", async (collectionSlug) => {
    expect(await generate("description", { collectionSlug, doc: {} })).toEqual({
      status: 200,
      result: DEFAULT_DESCRIPTION,
    })
  })
})
