// The queue Worker's entry (`main` in queue.wrangler.jsonc): OpenNext's revalidation queue,
// a Durable Object, in a Worker of its own. Cloudflare generates no Version URLs for a
// Worker that implements a Durable Object, and skew protection sends a tab opened before a
// deploy to the version that built its page through its Version URL, so the site's Worker
// binds to the class here instead (`script_name` in wrangler.jsonc).
//
// `pnpm build:worker` compiles the class with the build's preview-mode ID, which its
// revalidation requests carry, so this Worker is deployed from the same build as the site.

import { WorkerEntrypoint } from "cloudflare:workers"

export { DOQueueHandler } from "../../.open-next/.build/durable-objects/queue.js"

// Nothing is served here: the site reaches the class through its binding.
class Queue extends WorkerEntrypoint {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types -- a .mjs file can't carry types
  fetch() {
    return new Response("Not found", { status: 404 })
  }
}

export default Queue
