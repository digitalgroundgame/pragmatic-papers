import config from "@payload-config"
import { getPayload, type Payload } from "payload"

/**
 * The Payload instance, for server code that has no request to take it from: pages,
 * layouts, route handlers, `generateMetadata`. Code that does have one (hooks, endpoints,
 * access functions, jobs) uses `req.payload` instead. Payload keeps one instance per
 * process, so this is a lookup, not a new client.
 *
 * Storybook swaps this module for `src/stories/mocks/payload.ts` (`.storybook/main.ts`),
 * so every Payload read in a server component has to come through here.
 */
export async function getPayloadClient(): Promise<Payload> {
  return await getPayload({ config })
}
