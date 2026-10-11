// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import { grantPublicProfile } from "../grantPublicProfile"

interface Doc {
  id: number
  credited?: unknown
}

function fakeReq() {
  const update = vi.fn(async (_args: { where: unknown }) => ({ docs: [], errors: [] }))
  return { req: { payload: { update } }, update }
}

const hook = grantPublicProfile<Doc>((doc) => doc.credited as never)
const run = (doc: Doc, req: unknown) => hook({ doc, req } as never)

describe("grantPublicProfile", () => {
  it("marks every credited user who isn't public yet, in the save's transaction", async () => {
    const { req, update } = fakeReq()

    await run({ id: 1, credited: [4, 7] }, req)

    expect(update).toHaveBeenCalledExactlyOnceWith({
      collection: "users",
      where: { id: { in: [4, 7] }, publicProfile: { not_equals: true } },
      data: { publicProfile: true },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })

  it("reads ids from populated users and a single relationship", async () => {
    const { req, update } = fakeReq()

    await run({ id: 1, credited: [{ id: 4 }, 7] }, req)
    await run({ id: 2, credited: { id: 9 } }, req)

    expect(update.mock.calls.map(([args]) => args.where)).toEqual([
      { id: { in: [4, 7] }, publicProfile: { not_equals: true } },
      { id: { in: [9] }, publicProfile: { not_equals: true } },
    ])
  })

  it.each([
    ["no relationship", undefined],
    ["an empty one", null],
    ["no authors", []],
    ["only empty entries", [null, undefined]],
  ])("writes nothing when the document credits %s", async (_, credited) => {
    const { req, update } = fakeReq()

    await run({ id: 1, credited }, req)

    expect(update).not.toHaveBeenCalled()
  })

  it("returns the saved document unchanged", async () => {
    const { req } = fakeReq()
    const doc = { id: 1, credited: [4] }

    await expect(run(doc, req)).resolves.toBe(doc)
  })
})
