"use client"

import dynamic from "next/dynamic"

import type { AccountMenuProps } from "./AccountMenu"

// Base UI's menu loads with the comments, not with the article. Until it's in, a placeholder
// the avatar's size holds its place.
export const AccountMenu = dynamic<AccountMenuProps>(
  () => import("./AccountMenu").then((m) => m.AccountMenu),
  {
    ssr: false,
    loading: () => (
      <span className="inline-flex size-9 items-center justify-center">
        <span className="bg-muted size-9 rounded-full" />
      </span>
    ),
  },
)
