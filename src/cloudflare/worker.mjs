// The Cloudflare Worker's entry (`main` in wrangler.jsonc): OpenNext's worker, built into
// `.open-next/` by `pnpm build:worker`, behind `withOrigin`.
import openNext from "../../.open-next/worker.js"
import { withOrigin } from "./origin"

export { DOQueueHandler } from "../../.open-next/worker.js"

export default withOrigin(openNext)
