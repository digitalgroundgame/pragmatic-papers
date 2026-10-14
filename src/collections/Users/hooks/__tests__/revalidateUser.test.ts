import { revalidatePath } from "next/cache"
import type { Payload } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

import { isOnPublicPages, revalidateUser } from "../revalidateUser"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache: vi.fn() }))

const find = vi.fn()
const payload = { find, logger: { info: vi.fn() } } as unknown as Payload

const user = (overrides: Partial<User>) =>
  ({ id: 1, slug: "someone", roles: ["member"], publicProfile: false, ...overrides }) as User

const run = (doc: User, previousDoc: User = doc) =>
  revalidateUser({
    doc,
    previousDoc,
    req: { payload, context: {} },
  } as unknown as Parameters<typeof revalidateUser>[0])

beforeEach(() => {
  vi.clearAllMocks()
  find.mockResolvedValue({ docs: [] })
})

describe("isOnPublicPages", () => {
  it.each([
    [user({ roles: ["writer"] }), true],
    [user({ publicProfile: true }), true],
    [user({}), false],
    [null, false],
  ])("%#", (doc, expected) => {
    expect(isOnPublicPages(doc)).toBe(expected)
  })
})

describe("revalidateUser", () => {
  it("leaves the cache alone for a member", async () => {
    await run(user({ name: "New" }), user({ name: "Old" }))
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })

  it("refreshes a writer's page and the contributors index", async () => {
    await run(user({ roles: ["writer"] }))
    expect(revalidatePath).toHaveBeenCalledWith("/contributors/someone")
    expect(revalidatePath).toHaveBeenCalledWith("/contributors")
  })

  it("refreshes a member who just lost a staff role", async () => {
    await run(user({}), user({ roles: ["writer"] }))
    expect(revalidatePath).toHaveBeenCalledWith("/contributors")
  })
})
