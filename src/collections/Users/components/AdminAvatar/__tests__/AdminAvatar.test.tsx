import { createHash } from "node:crypto"

import { fireEvent, render, screen } from "@testing-library/react"
import type { Payload } from "payload"
import { describe, expect, it, vi } from "vitest"

import { AvatarChain } from "../AvatarChain"
import { AdminAvatar, avatarInitials, avatarSources, gravatarURL } from "../index"

const hash = createHash("sha256").update("ada@example.com").digest("hex")

describe("gravatarURL", () => {
  it("hashes the trimmed, lowercased address and asks for a 404 when there's none", () => {
    expect(gravatarURL("  Ada@Example.com ")).toBe(
      `https://www.gravatar.com/avatar/${hash}?s=50&r=g&d=404`,
    )
  })
})

describe("avatarSources", () => {
  it("puts the profile image first, then the saved picture, then Gravatar", () => {
    expect(
      avatarSources({
        email: "ada@example.com",
        profileImage: {
          id: 1,
          url: "/media/ada.jpg",
          sizes: { square: { url: "/media/ada-square.jpg" } },
        } as never,
        avatarUrl: "https://cdn.discordapp.com/a.png",
      }),
    ).toEqual([
      "/media/ada-square.jpg",
      "https://cdn.discordapp.com/a.png",
      `https://www.gravatar.com/avatar/${hash}?s=50&r=g&d=404`,
    ])
  })

  it("skips what's missing, including an unloaded profile image", () => {
    expect(avatarSources({ email: "ada@example.com", profileImage: 5, avatarUrl: null })).toEqual([
      `https://www.gravatar.com/avatar/${hash}?s=50&r=g&d=404`,
    ])
  })
})

describe("avatarInitials", () => {
  it("uses the name, then the address", () => {
    expect(avatarInitials({ name: "Ada Lovelace", email: "ada@example.com" })).toBe("AL")
    expect(avatarInitials({ name: "", email: "ada@example.com" })).toBe("AD")
  })
})

describe("AvatarChain", () => {
  it("falls through each picture that fails, then to the initials", () => {
    const { container } = render(<AvatarChain sources={["/a.png", "/b.png"]} initials="AL" />)
    const first = container.querySelector("img")
    expect(first).toHaveAttribute("src", "/a.png")
    fireEvent.error(first!)
    const second = container.querySelector("img")
    expect(second).toHaveAttribute("src", "/b.png")
    fireEvent.error(second!)
    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(screen.getByText("AL")).toBeInTheDocument()
  })

  it("shows the initials when there's no picture", () => {
    render(<AvatarChain sources={[]} initials="AL" />)
    expect(screen.getByText("AL")).toBeInTheDocument()
  })
})

describe("AdminAvatar", () => {
  it("reads the user past field access and renders their best picture", async () => {
    const findByID = vi.fn(async () => ({
      id: 3,
      email: "ada@example.com",
      name: "Ada Lovelace",
      profileImage: null,
      avatarUrl: "https://cdn.discordapp.com/a.png",
    }))
    const payload = { findByID } as unknown as Payload
    const { container } = render(
      (await AdminAvatar({ payload, user: { id: 3, collection: "users" } } as never)) as never,
    )
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "users", id: 3, overrideAccess: true }),
    )
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.discordapp.com/a.png",
    )
  })

  it("renders nothing without a signed-in user", async () => {
    expect(await AdminAvatar({ payload: {} as Payload, user: undefined } as never)).toBeNull()
  })
})
