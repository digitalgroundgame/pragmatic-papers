import { parseDrilldownAssetJson } from "./parseAsset"
import type { DrilldownAsset } from "./types"

/**
 * Fetches and parses child assets exactly once each, even under concurrent requests.
 *
 * Dedupe on the in-flight promise, not the finished value: a double-click on "View …" used to
 * race through the gap between the cache check and the cache write and inject one layer per
 * click. Failures are not cached, so a transient network error can be retried.
 *
 * A region arrives in two halves — its shapes from a URL that never changes for a given map,
 * its records from one that changes with every sync — fetched together and put back into the
 * single asset the stage expects. Both are composed on the server and served as JSON; the
 * client never parses SVG, so nothing here has to be a sanitizer.
 */
export class AssetLoader {
  private readonly loaded = new Map<string, DrilldownAsset>()
  private readonly pending = new Map<string, Promise<DrilldownAsset>>()

  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  get(url: string): DrilldownAsset | undefined {
    return this.loaded.get(url)
  }

  private async fetchAsset(url: string): Promise<DrilldownAsset> {
    const res = await this.fetchImpl(url, { credentials: "same-origin" })
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    return parseDrilldownAssetJson(await res.json())
  }

  load(url: string, geometryUrl: string): Promise<DrilldownAsset> {
    const cached = this.loaded.get(url)
    if (cached) return Promise.resolve(cached)
    const inFlight = this.pending.get(url)
    if (inFlight) return inFlight
    const p = (async () => {
      // Together, not one after the other: the region is not on screen until both are in.
      const [data, geometry] = await Promise.all([
        this.fetchAsset(url),
        this.fetchAsset(geometryUrl),
      ])
      const asset: DrilldownAsset = {
        viewBox: geometry.viewBox,
        flipY: geometry.flipY,
        paths: geometry.paths,
        payload: data.payload,
        payloadError: data.payloadError,
      }
      this.loaded.set(url, asset)
      this.pending.delete(url)
      return asset
    })().catch((err: unknown) => {
      this.pending.delete(url)
      throw err
    })
    this.pending.set(url, p)
    return p
  }
}
