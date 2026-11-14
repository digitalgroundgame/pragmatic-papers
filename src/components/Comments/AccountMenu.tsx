"use client"

import { LogOutIcon, UserIcon } from "lucide-react"
import Link from "next/link"
import React from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AuthorDisplay } from "@/plugins/comments"

import { AuthorAvatar } from "./CommentMeta"

export interface AccountMenuProps {
  viewer: Pick<AuthorDisplay, "name" | "image">
  onSignOut: () => void
}

/** The signed-in reader's avatar, opening their account and sign-out. */
export const AccountMenu: React.FC<AccountMenuProps> = ({ viewer, onSignOut }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button variant="ghost" size="icon-lg" className="rounded-full p-0" />}
    >
      <AuthorAvatar author={viewer} />
      {/* Named in text rather than `aria-label`, which would contradict the initials shown. */}
      <span className="sr-only">Account menu for {viewer.name}</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="min-w-48">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Signed in as {viewer.name}</DropdownMenuLabel>
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserIcon aria-hidden="true" />
          Your account
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onSignOut}>
        <LogOutIcon aria-hidden="true" />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)
