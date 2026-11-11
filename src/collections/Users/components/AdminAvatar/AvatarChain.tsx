"use client"

import React, { useState } from "react"

import "./AvatarChain.css"

export interface AvatarChainProps {
  /** Picture URLs, best first. Each that fails to load gives way to the next. */
  sources: string[]
  /** Shown when there's no picture, or none of them loads. */
  initials: string
}

/**
 * The account button's picture in the admin header: the first of `sources` that loads, else
 * the initials. Decorative, since the button around it is labelled "Account".
 */
export const AvatarChain: React.FC<AvatarChainProps> = ({ sources, initials }) => {
  const [failed, setFailed] = useState(0)
  const src = sources[failed]

  if (src) {
    return (
      // A remote picture of a fixed small size: next/image would add nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        className="admin-avatar"
        src={src}
        alt=""
        width={25}
        height={25}
        referrerPolicy="no-referrer"
        onError={() => setFailed((count) => count + 1)}
      />
    )
  }

  return (
    <span className="admin-avatar admin-avatar--initials" aria-hidden="true">
      {initials}
    </span>
  )
}
