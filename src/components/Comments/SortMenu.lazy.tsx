"use client"

import dynamic from "next/dynamic"

// The select (Base UI) loads only once a reader reaches the comments, not with the article.
export const SortMenu = dynamic(() => import("./SortMenu").then((m) => m.SortMenu), {
  ssr: false,
  loading: () => <span aria-hidden="true" className="inline-block h-7 w-24" />,
})
