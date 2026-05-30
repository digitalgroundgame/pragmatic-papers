import React from "react"

import { type Volume } from "@/payload-types"
import { Entry } from "./entry"
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Props = {
  volumes: Volume[]
}

export const VolumesView: React.FC<Props> = ({ volumes }) => {
  if (!volumes?.length) return null
  return volumes.map((volume, index) => {
    return <Entry key={volume.id || index} doc={volume} relationTo="volumes" />
  })
}
