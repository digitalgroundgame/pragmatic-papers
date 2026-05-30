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
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
