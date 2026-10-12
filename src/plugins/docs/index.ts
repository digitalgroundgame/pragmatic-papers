import type { Plugin } from "payload"

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
export const docsPlugin = (): Plugin => (config) => ({
  ...config,
  collections: [...(config.collections ?? []), Docs],
})
