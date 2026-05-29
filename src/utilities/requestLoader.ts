type Loader<K, V> = (key: K) => Promise<V | undefined>

interface State<K, V> {
  cache: Map<K, V | undefined>
  pendingIds: Set<K> | null
  pendingPromise: Promise<Map<K, V>> | null
}

/**
 * Per-request batched loader. Coalesces calls made within the same microtask
 * into a single `batchFn` invocation, then caches results on `context` so any
 * later call in the same request hits the cache. Intended for use inside
 * Payload `afterRead` hooks where many docs trigger redundant lookups.
 */
export function getRequestLoader<K, V>(
  context: Record<string, unknown>,
  cacheKey: string,
  batchFn: (keys: K[]) => Promise<Map<K, V>>,
): Loader<K, V> {
  let state = context[cacheKey] as State<K, V> | undefined
  if (!state) {
    state = { cache: new Map(), pendingIds: null, pendingPromise: null }
    context[cacheKey] = state
  }
  const s = state

  return async (key: K) => {
    if (s.cache.has(key)) return s.cache.get(key)

    if (!s.pendingIds) {
      const ids = new Set<K>()
      s.pendingIds = ids
      s.pendingPromise = new Promise((resolve, reject) => {
        queueMicrotask(async () => {
          s.pendingIds = null
          s.pendingPromise = null
          try {
            const results = await batchFn(Array.from(ids))
            for (const id of ids) s.cache.set(id, results.get(id))
            resolve(results)
          } catch (e) {
            reject(e)
          }
        })
      })
    }

    s.pendingIds.add(key)
    const results = await s.pendingPromise!
    return results.get(key)
  }
}
