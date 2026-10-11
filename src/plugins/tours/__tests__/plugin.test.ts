import type { Config } from "payload"
import { describe, expect, it } from "vitest"

import { toursPlugin } from ".."

const PROVIDER = "@/plugins/tours/TourProvider#TourProvider"

describe("toursPlugin", () => {
  it("adds the tour provider to the admin", () => {
    const config = toursPlugin()({} as Config) as Config
    expect(config.admin?.components?.providers).toEqual([PROVIDER])
  })

  it("keeps the providers and admin settings already there", () => {
    const config = toursPlugin()({
      admin: { user: "users", components: { providers: ["@/other#Other"], header: ["@/h#H"] } },
    } as Config) as Config
    expect(config.admin?.user).toBe("users")
    expect(config.admin?.components?.header).toEqual(["@/h#H"])
    expect(config.admin?.components?.providers).toEqual(["@/other#Other", PROVIDER])
  })
})
