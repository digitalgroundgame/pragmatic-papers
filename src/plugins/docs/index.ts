import type { Payload, Plugin } from "payload"

import { registerPlugin } from "@/utilities/registerPlugin"

import { Docs } from "./collection"
import { DOCS_CACHE_TAG } from "./revalidateDoc"

export { DOCS_SLUG } from "./collection"
export { DOCS_CACHE_TAG }

/**
 * Help docs at /docs/<slug>: the Docs collection. Once per deploy, `/next/revalidate-all`
 * seeds each site with the docs in src/docs/ it doesn't have yet, as drafts (see
 * `syncRepoDocs`), so a release that ships a doc has it waiting for an editor to publish.
 * `pnpm docs:export <slug>` writes one from the admin into the repo.
 */
export const docsPlugin = (
  options: {
    /**
     * Whether readers see the docs here: the reading of the plugin's switch. The pages and the
     * bell check the same switch; the collection is always there.
     */
    enabled?: (payload: Payload) => boolean | Promise<boolean>
  } = {},
): Plugin =>
  registerPlugin(
    "docs",
    {
      name: "Help docs",
      source: "src/plugins/docs",
      description:
        "Help docs at /docs, written in the admin or shipped in src/docs/ with a release.",
      enabled: options.enabled,
      switch: {
        label: "Help docs",
        description:
          "The help docs at /docs, their sitemap, and their items in the notifications bell. Staff can write docs in the admin either way.",
        defaultValue: false,
      },
    },
    (config) => ({ ...config, collections: [...(config.collections ?? []), Docs] }),
  )
