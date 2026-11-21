import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import { getSiteURL } from "@/utilities/getURL"
import { createUser, getPayload } from "./helpers/testUsers"

// Staging and every PR preview are subdomains of the production site, so SameSite=Lax
// doesn't keep their pages from sending production's login cookie. Payload's `csrf` list
// is what makes a request from one of them anonymous.

let payload: Payload
let token: string
let userId: number

beforeAll(async () => {
  payload = await getPayload()
  const user = await createUser("admin")
  userId = user.id
  const login = await payload.login({
    collection: "users",
    data: { email: user.email, password: "test-password" },
  })
  token = login.token!
})

/** Who Payload says a request with the login cookie and these headers is. */
async function whoIs(headers: Record<string, string>): Promise<number | null> {
  const { user } = await payload.auth({
    headers: new Headers({ cookie: `payload-token=${token}`, ...headers }),
  })
  return user?.id ?? null
}

describe("the login cookie", () => {
  it("is only taken from this site's origin", () => {
    expect(payload.config.csrf).toEqual([getSiteURL()])
  })

  it("signs in a request from the site itself", async () => {
    expect(await whoIs({ origin: getSiteURL() })).toBe(userId)
  })

  it("signs in a page load, which names no origin", async () => {
    expect(await whoIs({ "sec-fetch-site": "none" })).toBe(userId)
    expect(await whoIs({ "sec-fetch-site": "same-origin" })).toBe(userId)
  })

  it.each([
    "https://pr-123.pragmaticpapers.com",
    "https://staging.pragmaticpapers.com",
    "https://example.com",
  ])("is ignored on a request from %s", async (origin) => {
    expect(await whoIs({ origin })).toBeNull()
    // What a browser sends from a sibling subdomain: Payload has to go by the Origin.
    expect(await whoIs({ origin, "sec-fetch-site": "same-site" })).toBeNull()
  })

  it("is ignored on a cross-site request that names no origin", async () => {
    expect(await whoIs({ "sec-fetch-site": "cross-site" })).toBeNull()
  })

  it("leaves a token sent in the Authorization header alone", async () => {
    const { user } = await payload.auth({
      headers: new Headers({ authorization: `JWT ${token}`, origin: "https://example.com" }),
    })
    expect(user?.id).toBe(userId)
  })
})
