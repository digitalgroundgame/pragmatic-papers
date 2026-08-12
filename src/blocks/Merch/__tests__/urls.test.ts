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

  it("comes entirely from MERCH_SITE_URL, with no site baked in", () => {
    process.env.MERCH_SITE_URL = "https://store-site.test/shop"

    expect(getMerchStoreUrl()).toBe("https://store-site.test/shop")
    expect(getMerchProductUrl("logo-tee")).toBe("https://store-site.test/shop/logo-tee")
  })

  it("is null when unconfigured, so the block renders nothing rather than guessing", () => {
    expect(getMerchStoreUrl()).toBeNull()
    expect(getMerchProductUrl("logo-tee")).toBeNull()
  })

  it("treats a blank or unparseable value as unconfigured", () => {
    process.env.MERCH_SITE_URL = "   "
    expect(getMerchStoreUrl()).toBeNull()

    process.env.MERCH_SITE_URL = "not a url"
    expect(getMerchStoreUrl()).toBeNull()
  })

  it("does not double up on a trailing slash", () => {
    process.env.MERCH_SITE_URL = "https://store-site.test/shop/"

    expect(getMerchStoreUrl()).toBe("https://store-site.test/shop")
    expect(getMerchProductUrl("logo-tee")).toBe("https://store-site.test/shop/logo-tee")
  })

  it("escapes a handle so it can't break out of the path", () => {
    process.env.MERCH_SITE_URL = "https://store-site.test/shop"

    expect(getMerchProductUrl("tee/../admin")).toBe("https://store-site.test/shop/tee%2F..%2Fadmin")
  })
})
