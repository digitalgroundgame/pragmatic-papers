import { afterEach, describe, expect, it, vi } from "vitest"

import { pictureURL, rememberPicture, savePicture, takePicture } from "../pictures"

const pool = () => ({ query: vi.fn() })

afterEach(() => vi.useRealTimers())

describe("pictureURL", () => {
  it("keeps https URLs only", () => {
    expect(pictureURL("https://cdn.discordapp.com/avatars/1/a.png")).toBe(
      "https://cdn.discordapp.com/avatars/1/a.png",
    )
    expect(pictureURL("http://example.com/a.png")).toBeNull()
    expect(pictureURL("javascript:alert(1)")).toBeNull()
    expect(pictureURL("not a url")).toBeNull()
    expect(pictureURL("")).toBeNull()
    expect(pictureURL(undefined)).toBeNull()
  })
})

describe("rememberPicture / takePicture", () => {
  it("hands a picture over once, for the same user and provider", () => {
    rememberPicture("1", "google", "https://example.com/a.png")
    expect(takePicture("1", "discord")).toBeNull()
    expect(takePicture("2", "google")).toBeNull()
    expect(takePicture("1", "google")).toBe("https://example.com/a.png")
    expect(takePicture("1", "google")).toBeNull()
  })

  it("holds nothing for a provider that sent no usable picture", () => {
    rememberPicture("1", "destiny", undefined)
    rememberPicture("1", "discord", "http://example.com/a.png")
    expect(takePicture("1", "destiny")).toBeNull()
    expect(takePicture("1", "discord")).toBeNull()
  })

  it("forgets a picture after a minute", () => {
    vi.useFakeTimers()
    rememberPicture("1", "google", "https://example.com/a.png")
    vi.advanceTimersByTime(61_000)
    expect(takePicture("1", "google")).toBeNull()
  })
})

describe("savePicture", () => {
  it("saves the held picture to a user with none", async () => {
    const db = pool()
    rememberPicture("4", "google", "https://example.com/a.png")
    await savePicture(db as never, "users", { userId: 4, providerId: "google" }, async () => false)
    const [sql, values] = db.query.mock.calls[0]!
    expect(sql).toContain('update "users" set avatar_url = $1')
    expect(sql).toContain("avatar_url is null")
    expect(values).toEqual(["https://example.com/a.png", 4])
  })

  it("leaves a user with a profile image alone", async () => {
    const db = pool()
    rememberPicture("4", "google", "https://example.com/a.png")
    await savePicture(db as never, "users", { userId: 4, providerId: "google" }, async () => true)
    expect(db.query).not.toHaveBeenCalled()
  })

  it("does nothing without a held picture", async () => {
    const db = pool()
    const hasPicture = vi.fn(async () => false)
    await savePicture(db as never, "users", { userId: 4, providerId: "discord" }, hasPicture)
    expect(hasPicture).not.toHaveBeenCalled()
    expect(db.query).not.toHaveBeenCalled()
  })
})
