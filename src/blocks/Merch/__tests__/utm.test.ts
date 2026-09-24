import { describe, expect, it } from "vitest"

import { withMerchUtm } from "../utm"

describe("withMerchUtm", () => {
  it("tags a plain storefront URL", () => {
    const tagged = new URL(withMerchUtm("https://store.example.com/mug", "square_product"))

    expect(tagged.searchParams.get("utm_source")).toBe("pragmaticpapers")
    expect(tagged.searchParams.get("utm_medium")).toBe("merch_block")
    expect(tagged.searchParams.get("utm_content")).toBe("square_product")
  })

  it("preserves query params the URL already carries", () => {
    const tagged = new URL(withMerchUtm("https://store.example.com/mug?variant=large", "x"))

    expect(tagged.searchParams.get("variant")).toBe("large")
    expect(tagged.searchParams.get("utm_source")).toBe("pragmaticpapers")
  })

  it("does not clobber params an editor set by hand", () => {
    const tagged = new URL(withMerchUtm("https://store.example.com/?utm_source=newsletter", "x"))

    expect(tagged.searchParams.get("utm_source")).toBe("newsletter")
    // The untouched ones still get filled in.
    expect(tagged.searchParams.get("utm_medium")).toBe("merch_block")
  })

  it("returns unparseable URLs untouched rather than dropping them", () => {
    expect(withMerchUtm("/store", "x")).toBe("/store")
    expect(withMerchUtm("not a url", "x")).toBe("not a url")
  })

  it("leaves non-http schemes alone", () => {
    expect(withMerchUtm("mailto:shop@example.com", "x")).toBe("mailto:shop@example.com")
  })
})
