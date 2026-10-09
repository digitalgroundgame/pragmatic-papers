// The Cloudflare Worker's entry (`main` in wrangler.jsonc): OpenNext's worker, built into
// `.open-next/` by `pnpm build:worker`, behind `withOrigin`.
import openNext from "../../.open-next/worker.js"
import { logErrorCauses, withOrigin } from "./origin"

export { DOQueueHandler } from "../../.open-next/worker.js"

logErrorCauses()

export default withOrigin(openNext)
