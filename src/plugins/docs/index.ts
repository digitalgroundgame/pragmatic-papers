import { registerPlugin, type SitePluginOptions } from "@/utilities/registerPlugin"
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs"

import { Docs, DOCS_SLUG } from "./collection"
import { DOCS_CACHE_TAG } from "./revalidateDoc"
import { docNavTitle, docURL } from "./sections"

export { DOCS_SLUG }
export { DOCS_CACHE_TAG }

/**
 * Help docs at /docs: the Docs collection, nested into areas, their sections and the sections'
 * docs, each read at the address its place gives it (`/docs/writing/articles/footnotes`). Once
 * per deploy, `/next/revalidate-all` seeds each site with the docs in src/docs/ it doesn't have
 * yet, as drafts (see `syncRepoDocs`), so a release that ships a doc has it waiting for an
 * editor to publish. `pnpm docs:export <slug>` writes one from the admin into the repo.
 */
export const docsPlugin = registerPlugin<SitePluginOptions>({
  slug: "docs",
  manifest: {
    name: "Help docs",
    source: "src/plugins/docs",
    description: "Help docs at /docs, written in the admin or shipped in src/docs/ with a release.",
    switch: {
      label: "Help docs",
      description:
        "The help docs at /docs, their sitemap, and their items in the notifications bell. Staff can write docs in the admin either way.",
      defaultValue: false,
    },
  },
  // `enabled` is the plugin's switch, which the pages and the bell check; the collection is
  // always there. Docs nest with the nested docs plugin, applied here so it finds the
  // collection: it adds each doc's `parent`, and keeps its `breadcrumbs` (labels and addresses)
  // in step when an ancestor moves or is renamed.
  plugin: ({ config }) =>
    nestedDocsPlugin({
      collections: [DOCS_SLUG],
      generateLabel: (_, doc) => docNavTitle(doc as { title: string; navTitle?: string | null }),
      generateURL: (docs) => docURL(docs.map((doc) => doc.slug as string | null | undefined)),
    })({
      ...config,
      collections: [...(config.collections ?? []), Docs],
    }),
})
