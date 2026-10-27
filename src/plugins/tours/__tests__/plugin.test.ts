import type { Config } from "payload"
import { describe, expect, it } from "vitest"

import { registeredPlugins } from "@/utilities/registerPlugin"

import { toursPlugin } from ".."

const PROVIDER = "@/plugins/tours/TourGate#TourGate"

describe("toursPlugin", () => {
  it("adds the tours' provider to the admin", () => {
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

  it("keeps its options in the config's custom, beside what's already there", () => {
    const enabled = async () => false
    const config = toursPlugin({ enabled })({ custom: { other: 1 } } as unknown as Config) as Config
    expect(config.custom).toMatchObject({ other: 1, tours: { enabled } })
  })

  it("lists itself on System → Plugins, with its switch", () => {
    const enabled = async () => false
    const config = toursPlugin({ enabled })({} as Config) as Config
    expect(registeredPlugins(config)).toEqual([
      expect.objectContaining({ slug: "tours", name: "Guided tours", enabled }),
    ])
  })
})
