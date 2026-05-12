import type { Volume, VolumeView as VolumeBlockProps } from "@/payload-types"

import RichText from "@/components/RichText"
import configPromise from "@payload-config"
import { getPayload } from "payload"
import React from "react"

import { PageRange } from "@/components/PageRange"
import { PaginationVolumes } from "@/components/PaginationVolumes"
import { VolumesView } from "@/components/VolumesView"

export const VolumeViewBlock: React.FC<
  VolumeBlockProps & {
    id?: string | null
    pageNumber?: number
  }
> = async (props) => {
  const { id, introContent, populateBy, selectedDocs, pageNumber, limit: limitFromProps } = props

  if (populateBy === "collection") {
    const payload = await getPayload({ config: configPromise })

    const limit = limitFromProps || 6

    const { docs, page, totalDocs, totalPages } = await payload.find({
      collection: "volumes",
      depth: 1,
      limit,
      page: pageNumber,
      overrideAccess: false,
      select: {
        title: true,
        slug: true,
        description: true,
        volumeNumber: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
      sort: "-volumeNumber",
    })

    return (
      <div className="container my-4 max-w-3xl space-y-8" id={id ?? undefined}>
        {introContent && (
          <RichText className="font-display" data={introContent} enableGutter={false} />
        )}
        <VolumesView volumes={docs} />
        <PageRange collection="volumes" currentPage={page} limit={limit} totalDocs={totalDocs} />
        {totalPages > 1 && page && (
          <div className="container">
            <PaginationVolumes page={page} totalPages={totalPages} />
          </div>
        )}
      </div>
    )
  } else {
    if (selectedDocs?.length) {
      const volumes = selectedDocs.map((post) => {
        if (typeof post.value === "object") return post.value
      }) as Volume[]

      return (
        <div className="my-4" id={`block-${id}`}>
          {introContent && (
            <div className="container mb-16">
              <RichText className="ms-0 max-w-3xl" data={introContent} enableGutter={false} />
            </div>
          )}
          <VolumesView volumes={volumes} />
        </div>
      )
    }
  }
}
