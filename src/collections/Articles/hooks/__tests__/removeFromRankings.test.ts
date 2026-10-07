// @vitest-environment node
import type { ArticleRecommendation } from "@/payload-types"
import { describe, expect, it, vi } from "vitest"

import { removeFromRankings } from "../removeFromRankings"

type Rankings = NonNullable<ArticleRecommendation["rankings"]>

/**
 * A Payload stand-in whose global holds `rankings`, read and written the way the hook does.
 * Reads and writes each wait a tick, so hooks started together really do overlap.
 */
function fakeReq(rankings: Rankings) {
  const state = { rankings }
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
  const findGlobal = vi.fn(async () => {
    await tick()
    return { rankings: state.rankings }
  })
  const updateGlobal = vi.fn(async ({ data }: { data: { rankings: Rankings } }) => {
    await tick()
    state.rankings = data.rankings
  })
  const req = { payload: { findGlobal, updateGlobal } }
  return { req, state, findGlobal, updateGlobal }
}

const ranking = (article: Rankings[number]["article"], engagementScore = 1) => ({
  article,
  engagementScore,
})

const run = (id: number | string, req: unknown) => removeFromRankings({ id, req } as never)

describe("removeFromRankings", () => {
  it("drops the deleted article and keeps the rest in order", async () => {
    const { req, state, updateGlobal } = fakeReq([ranking(1, 3), ranking(2, 2), ranking(3, 1)])

    await run(2, req)

    expect(state.rankings).toEqual([ranking(1, 3), ranking(3, 1)])
    expect(updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "article-recommendations", req }),
    )
  })

  it("matches a populated article and a string id", async () => {
    const { req, state } = fakeReq([ranking({ id: 5 } as never), ranking(6)])

    await run("5", req)

    expect(state.rankings).toEqual([ranking(6)])
  })

  it("writes nothing when the article isn't ranked", async () => {
    const { req, updateGlobal } = fakeReq([ranking(1)])

    await run(9, req)

    expect(updateGlobal).not.toHaveBeenCalled()
  })

  it("writes nothing when there are no rankings", async () => {
    const { req, findGlobal, updateGlobal } = fakeReq([])
    findGlobal.mockResolvedValueOnce({ rankings: null as never })

    await run(1, req)

    expect(updateGlobal).not.toHaveBeenCalled()
  })

  it("removes every article when a bulk delete runs the hooks at once", async () => {
    const { req, state } = fakeReq([ranking(1), ranking(2), ranking(3)])

    await Promise.all([run(1, req), run(3, req)])

    expect(state.rankings).toEqual([ranking(2)])
  })

  it("keeps going after an earlier run on the same request fails", async () => {
    const { req, state, findGlobal } = fakeReq([ranking(1), ranking(2)])
    findGlobal.mockRejectedValueOnce(new Error("boom"))

    const results = await Promise.allSettled([run(1, req), run(2, req)])

    expect(results.map((result) => result.status)).toEqual(["rejected", "fulfilled"])
    expect(state.rankings).toEqual([ranking(1)])
  })
})
