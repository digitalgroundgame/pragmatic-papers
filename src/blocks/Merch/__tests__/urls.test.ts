import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { getMerchProductUrl, getMerchStoreUrl } from "../urls"

const original = process.env.MERCH_SITE_URL

afterEach(() => {
  if (original === undefined) delete process.env.MERCH_SITE_URL
  else process.env.MERCH_SITE_URL = original
})

describe("merch URLs", () => {
  beforeEach(() => {
    delete process.env.MERCH_SITE_URL
  })

  it("points at the DGG site, not the Shopify store that supplies the data", () => {
    expect(getMerchStoreUrl()).toBe("https://digitalgroundgame.org/merch")
    expect(getMerchProductUrl("logo-tee")).toBe("https://digitalgroundgame.org/merch/logo-tee")
    expect(getMerchProductUrl("logo-tee")).not.toContain("store.digitalgroundgame.org")
  })

  it("follows MERCH_SITE_URL, path and all, so the storefront can move", () => {
    process.env.MERCH_SITE_URL = "https://staging.digitalgroundgame.org/shop"

    expect(getMerchStoreUrl()).toBe("https://staging.digitalgroundgame.org/shop")
    expect(getMerchProductUrl("logo-tee")).toBe(
      "https://staging.digitalgroundgame.org/shop/logo-tee",
    )
  })

  it("does not double up on a trailing slash", () => {
    process.env.MERCH_SITE_URL = "https://digitalgroundgame.org/merch/"

    expect(getMerchStoreUrl()).toBe("https://digitalgroundgame.org/merch")
    expect(getMerchProductUrl("logo-tee")).toBe("https://digitalgroundgame.org/merch/logo-tee")
  })

  it("falls back to the default when the env var is blank", () => {
    process.env.MERCH_SITE_URL = "   "

    expect(getMerchStoreUrl()).toBe("https://digitalgroundgame.org/merch")
  })

  it("escapes a handle so it can't break out of the path", () => {
    expect(getMerchProductUrl("tee/../admin")).toBe(
      "https://digitalgroundgame.org/merch/tee%2F..%2Fadmin",
    )
  })
})
