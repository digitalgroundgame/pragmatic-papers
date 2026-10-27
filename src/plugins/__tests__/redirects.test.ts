// @vitest-environment node
import configPromise from "@payload-config"
import type { PayloadRequest, SanitizedCollectionConfig } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

const user = (role: string) => ({ id: 1, collection: "users", roles: [role] })

let redirects: SanitizedCollectionConfig
beforeAll(async () => {
  const config = await configPromise
  redirects = config.collections.find(({ slug }) => slug === "redirects")!
})

/** What an access rule answers for a request from `who`. */
function answer(rule: unknown, who: unknown): unknown {
  if (typeof rule !== "function") return undefined
  const req = { user: who, headers: new Headers(), context: {} } as unknown as PayloadRequest
  return rule({ req, data: {}, id: undefined })
}

describe("redirects collection", () => {
  it("shows in the admin's Site group to admins and chief editors only", () => {
    const hidden = redirects.admin.hidden
    expect(typeof hidden).toBe("function")
    if (typeof hidden !== "function") return

    expect(redirects.admin.group).toBe("Site")
    expect(hidden({ user: user("admin") } as never)).toBe(false)
    expect(hidden({ user: user("chief-editor") } as never)).toBe(false)
    expect(hidden({ user: user("editor") } as never)).toBe(true)
    expect(hidden({ user: user("writer") } as never)).toBe(true)
  })

  it("lets only admins create, change or delete a redirect", () => {
    for (const op of ["create", "update", "delete"] as const) {
      expect(answer(redirects.access[op], user("admin"))).toBe(true)
      expect(answer(redirects.access[op], user("editor"))).toBe(false)
      expect(answer(redirects.access[op], user("writer"))).toBe(false)
      expect(answer(redirects.access[op], null)).toBe(false)
    }
  })

  it("stays readable by anyone, since every public page checks it on a miss", () => {
    expect(answer(redirects.access.read, null)).toBe(true)
  })

  it("clears the cached redirects when one is saved or deleted", () => {
    expect(redirects.hooks.afterChange.map((hook) => hook.name)).toContain("revalidateRedirects")
    expect(redirects.hooks.afterDelete.map((hook) => hook.name)).toContain(
      "revalidateRedirectsDelete",
    )
  })
})
