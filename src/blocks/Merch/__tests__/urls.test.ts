import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { getMerchProductUrl, getMerchSiteUrl, getMerchStoreUrl } from "../urls"

const original = process.env.MERCH_SITE_URL

afterEach(() => {
  if (original === undefined) delete process.env.MERCH_SITE_URL
  else process.env.MERCH_SITE_URL = original
})

describe("merch URLs", () => {
  beforeEach(() => {
    delete process.env.MERCH_SITE_URL
  })

  it("points at the DiGG site, not the Shopify store that supplies the data", () => {
    expect(getMerchSiteUrl()).toBe("https://digitalgroundgame.org")
    expect(getMerchStoreUrl()).toBe("https://digitalgroundgame.org/merch")
    expect(getMerchProductUrl("logo-tee")).toBe("https://digitalgroundgame.org/merch/logo-tee")
    expect(getMerchProductUrl("logo-tee")).not.toContain("store.digitalgroundgame.org")
  })

  it("follows MERCH_SITE_URL so staging can point elsewhere", () => {
    process.env.MERCH_SITE_URL = "https://staging.digitalgroundgame.org"

    expect(getMerchStoreUrl()).toBe("https://staging.digitalgroundgame.org/merch")
  })

  it("does not double up on a trailing slash", () => {
    process.env.MERCH_SITE_URL = "https://digitalgroundgame.org/"

    expect(getMerchStoreUrl()).toBe("https://digitalgroundgame.org/merch")
  })

  it("falls back to the default when the env var is blank", () => {
    process.env.MERCH_SITE_URL = "   "

    expect(getMerchSiteUrl()).toBe("https://digitalgroundgame.org")
  })

  it("escapes a handle so it can't break out of the path", () => {
    expect(getMerchProductUrl("tee/../admin")).toBe(
      "https://digitalgroundgame.org/merch/tee%2F..%2Fadmin",
    )
  })
})
