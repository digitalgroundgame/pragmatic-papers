import { createHash } from "node:crypto"

import type { Media, User } from "@/payload-types"
import { getInitials } from "@/utilities/getInitials"
import { getMediaUrl } from "@/utilities/getMediaUrl"
import type { ServerProps } from "payload"
import React from "react"

import { AvatarChain } from "./AvatarChain"

/** Gravatar's picture for an address, or a 404 when it has none, so the next source shows. */
export function gravatarURL(email: string): string {
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex")
  return `https://www.gravatar.com/avatar/${hash}?s=50&r=g&d=404`
}

/** The profile image's square crop, or the image itself. */
function profileImageURL(image: User["profileImage"]): string | null {
  if (!image || typeof image !== "object") return null
  const media = image as Media
  return getMediaUrl(media.sizes?.square?.url ?? media.url, media.updatedAt) || null
}

/**
 * The pictures that can stand for a user, best first: the profile image set on their record,
 * the picture saved from the first account they linked, then Gravatar's for their address.
 */
export function avatarSources(
  user: Pick<User, "email" | "profileImage"> & { avatarUrl?: string | null },
): string[] {
  return [
    profileImageURL(user.profileImage),
    user.avatarUrl ?? null,
    user.email ? gravatarURL(user.email) : null,
  ].filter((src): src is string => Boolean(src))
}

/** Initials for the name, else the address's first letters. */
export function avatarInitials(user: Pick<User, "email" | "name">): string {
  return getInitials(user.name || user.email?.split("@")[0] || "") || "?"
}

/**
 * The admin header's account picture (Payload's `admin.avatar`): profile image, then the
 * linked account's picture, then Gravatar, then initials.
 */
export async function AdminAvatar({ payload, user }: ServerProps): Promise<React.ReactNode> {
  if (!payload || !user || user.collection !== "users") return null

  // `avatarUrl` is hidden from the API, so read it past field access.
  const record = (await payload
    .findByID({
      collection: "users",
      id: user.id,
      depth: 1,
      select: { email: true, name: true, profileImage: true, avatarUrl: true },
      overrideAccess: true,
    })
    .catch(() => null)) as (User & { avatarUrl?: string | null }) | null
  if (!record) return null

  return <AvatarChain sources={avatarSources(record)} initials={avatarInitials(record)} />
}
