import { registerPlugin, type SitePluginOptions } from "@/utilities/registerPlugin"
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs"

import { Docs } from "./collection"
import { DOC_SECTIONS_SLUG, DocSections } from "./docSections"
import { DOCS_CACHE_TAG } from "./revalidateDoc"

export { DOCS_SLUG } from "./collection"
export { DOC_SECTIONS_SLUG } from "./docSections"
export { DOCS_CACHE_TAG }

/**
 * Help docs at /docs/<slug>: the Docs collection, filed under the areas and sections editors
 * keep in the Sections collection. Once per deploy, `/next/revalidate-all` seeds each site with
 * the starter sections and the docs in src/docs/ it doesn't have yet, docs as drafts (see
 * `syncRepoDocs`), so a release that ships a doc has it waiting for an editor to publish.
 * `pnpm docs:export <slug>` writes one from the admin into the repo.
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
  // `enabled` is the plugin's switch, which the pages and the bell check; the collections are
  // always there. Sections nest under areas with the nested docs plugin, applied here so it
  // finds the collection.
  plugin: ({ config }) =>
    nestedDocsPlugin({ collections: [DOC_SECTIONS_SLUG] })({
      ...config,
      collections: [...(config.collections ?? []), DocSections, Docs],
    }),
})
