import type { Plugin } from "payload"

import { Docs } from "./collection"
import { DOCS_CACHE_TAG } from "./revalidateDoc"
import { markDocsSynced } from "./syncVersion"
import { syncDocs } from "./syncDocs"

export { DOCS_SLUG } from "./collection"
export { DOCS_CACHE_TAG }

/**
 * Only the running site syncs: not `next build`, which loads Payload to prerender, not the
 * Payload CLI (`payload migrate` and friends, which Next doesn't run), and not tests, which
 * call `syncDocs` themselves when they want it. `process.env.NEXT_RUNTIME` has to be read
 * literally: Next writes its value into the bundle at build time, and a production server
 * never sets it in the environment.
 */
const shouldSync = (): boolean =>
  process.env.NEXT_RUNTIME === "nodejs" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !process.env.VITEST &&
  process.env.DOCS_SYNC !== "false"

/**
 * Help docs at /docs/<slug>: the Docs collection, and the docs in src/docs/ written into
 * this site's database each time it starts. A release that ships a doc has it on every
 * site the moment it's deployed. `pnpm docs:export <slug>` writes one from the admin into
 * the repo.
 */
export const docsPlugin = (): Plugin => (config) => ({
  ...config,
  collections: [...(config.collections ?? []), Docs],
  onInit: async (payload) => {
    await config.onInit?.(payload)
    if (!shouldSync()) return
    // In the background: the site shouldn't wait on uploads to start serving.
    void syncDocs(payload)
      .then(({ created, updated }) => {
        if (!created.length && !updated.length) return
        payload.logger.info({ created, updated }, "Synced help docs from the repo")
        markDocsSynced()
      })
      .catch((err: unknown) => payload.logger.error({ err }, "Syncing help docs failed"))
  },
})
