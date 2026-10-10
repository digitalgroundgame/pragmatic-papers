import type { Plugin } from "payload"

import { Docs } from "./collection"
import { DOCS_CACHE_TAG } from "./revalidateDoc"

export { DOCS_SLUG } from "./collection"
export { DOCS_CACHE_TAG }

/**
 * Help docs at /docs/<slug>: the Docs collection. The docs in src/docs/ are written into each
 * site's database once per deploy, by `/next/revalidate-all` (see `syncRepoDocs`), so a
 * release that ships a doc has it on every site the moment it's live. `pnpm docs:export
 * <slug>` writes one from the admin into the repo.
 */
export const docsPlugin = (): Plugin => (config) => ({
  ...config,
  collections: [...(config.collections ?? []), Docs],
})
