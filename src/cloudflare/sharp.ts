/**
 * `sharp` for Payload's image handling, imported from here rather than directly. Next
 * lists sharp among its built-in server externals, so an alias can't stub it; the
 * Cloudflare Worker build (`../withCloudflare.ts`) swaps this module for
 * `stubs/unavailable.ts` instead. Uploads, the only callers, run on Coolify.
 */
import sharp from "sharp"

export default sharp
