import { act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { markSeen, resetSeenStore, SEEN_KEY_PREFIX, seenNames } from "../store"
import {
  linkSeenToAccount,
  parseSeenPreference,
  SEEN_PREFERENCE_KEY,
  unlinkSeenFromAccount,
} from "../sync"

/** A Payload that keeps one preference, answering as its REST endpoint does. */
function stubAccount(stored: string[] | null) {
  let value: unknown = stored === null ? null : { names: stored }
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      value = (JSON.parse(String(init.body)) as { value: unknown }).value
      return { ok: true, json: async () => ({ doc: { value } }) } as Response
    }
    return { ok: true, json: async () => ({ value }) } as Response
  })
  vi.stubGlobal("fetch", fetchMock)
  return {
    fetchMock,
    posts: () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
    stored: () => parseSeenPreference(value).sort(),
  }
}

// Lets the background sync a markSeen starts settle.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

beforeEach(() => {
  localStorage.clear()
  resetSeenStore()
})

afterEach(async () => {
  await settle()
  unlinkSeenFromAccount()
  vi.unstubAllGlobals()
})

describe("parseSeenPreference", () => {
  it("reads the stored names, dropping anything that isn't one", () => {
    expect(parseSeenPreference({ names: ["a", 2, "b", null] })).toEqual(["a", "b"])
  })

  it.each([null, undefined, "names", { names: "a" }, {}])("reads nothing from %j", (value) => {
    expect(parseSeenPreference(value)).toEqual([])
  })
})

describe("linking seen names to an account", () => {
  it("reads and writes the reader's own preference, with their cookie", async () => {
    const account = stubAccount(null)
    localStorage.setItem(`${SEEN_KEY_PREFIX}mode-toggle`, "1")

    await linkSeenToAccount()

    expect(account.fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/api/payload-preferences/${SEEN_PREFERENCE_KEY}$`)),
      expect.objectContaining({ credentials: "include" }),
    )
    expect(account.posts()[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: "include", method: "POST" }),
    )
  })

  it("merges this browser's names with the account's, both ways", async () => {
    const account = stubAccount(["seen-elsewhere"])
    localStorage.setItem(`${SEEN_KEY_PREFIX}seen-here`, "1")

    await linkSeenToAccount()

    expect(localStorage.getItem(`${SEEN_KEY_PREFIX}seen-elsewhere`)).toBe("1")
    expect(seenNames()?.sort()).toEqual(["seen-elsewhere", "seen-here"])
    expect(account.stored()).toEqual(["seen-elsewhere", "seen-here"])
  })

  it("doesn't write when the account already has everything", async () => {
    const account = stubAccount(["a", "b"])
    localStorage.setItem(`${SEEN_KEY_PREFIX}a`, "1")

    await linkSeenToAccount()

    expect(account.posts()).toHaveLength(0)
    expect(seenNames()?.sort()).toEqual(["a", "b"])
  })

  it("adds a name seen while logged in to the account", async () => {
    const account = stubAccount([])
    await linkSeenToAccount()

    act(() => markSeen("mode-toggle"))
    await settle()

    expect(account.stored()).toEqual(["mode-toggle"])
  })

  it("keeps a name another browser added since this one linked", async () => {
    const account = stubAccount([])
    await linkSeenToAccount()
    // Another browser, linked to the same account, sees something.
    await fetch("/", { method: "POST", body: JSON.stringify({ value: { names: ["other"] } }) })

    act(() => markSeen("mode-toggle"))
    await settle()

    expect(account.stored()).toEqual(["mode-toggle", "other"])
  })

  it("doesn't lose a name seen while a sync is still running", async () => {
    const account = stubAccount([])
    const linking = linkSeenToAccount()
    act(() => markSeen("first"))
    act(() => markSeen("second"))
    await linking
    await settle()

    expect(account.stored()).toEqual(["first", "second"])
  })

  it("sends nothing once logged out, and keeps what this browser has seen", async () => {
    const account = stubAccount([])
    await linkSeenToAccount()
    unlinkSeenFromAccount()
    account.fetchMock.mockClear()

    act(() => markSeen("mode-toggle"))
    await settle()

    expect(account.fetchMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(`${SEEN_KEY_PREFIX}mode-toggle`)).toBe("1")
  })

  it.each([
    ["Payload answers with an error", { ok: false }],
    ["Payload can't be reached", new Error("offline")],
  ])("leaves this browser as it is when %s", async (_, response) => {
    const fetchMock = vi.fn(async () => {
      if (response instanceof Error) throw response
      return { ok: false, json: async () => ({}) } as unknown as Response
    })
    vi.stubGlobal("fetch", fetchMock)
    localStorage.setItem(`${SEEN_KEY_PREFIX}a`, "1")

    await expect(linkSeenToAccount()).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(seenNames()).toEqual(["a"])
  })

  it("uses the account's names on this page when localStorage is blocked", async () => {
    stubAccount(["seen-elsewhere"])
    localStorage.setItem("unrelated", "1")
    vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    resetSeenStore()
    expect(seenNames()).toBeNull()

    await linkSeenToAccount()

    expect(seenNames()).toEqual(["seen-elsewhere"])
    vi.restoreAllMocks()
  })
})
