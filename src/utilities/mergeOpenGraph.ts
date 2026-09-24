import type { Metadata } from "next"
import { getServerSideURL } from "./getURL"

const defaultOpenGraph: Metadata["openGraph"] = {
  type: "website",
  description:
    "Pragmatic, community-driven articles focusing on news, politics, economics, and more.",
  images: [
    {
      url: `${getServerSideURL()}/the-pragmatic-papers-opengraph-image.png`,
      alt: `The Pragmatic Papers icon: a large white "P" on the left, paired with a white panel on the right containing the wordmark "The Pragmatic Papers" in bold condensed type — all on an orange-red background.`,
    },
  ],
  siteName: "The Pragmatic Papers",
  title: "The Pragmatic Papers",
}

export const mergeOpenGraph = (og?: Metadata["openGraph"]): Metadata["openGraph"] => {
  const images = og?.images
  const hasImages = Array.isArray(images) ? images.length > 0 : Boolean(images)

  return {
    ...defaultOpenGraph,
    ...og,
    images: hasImages ? images : defaultOpenGraph.images,
  }
}
