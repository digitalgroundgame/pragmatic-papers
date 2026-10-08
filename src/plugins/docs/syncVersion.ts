/**
 * Changes when this server's start-up sync writes docs. A sync can't clear Next's cache (it
 * runs outside a request), and anything read before it finished would otherwise stay cached,
 * so the cache keys carry this instead. On `globalThis`, because each route bundles its own
 * copy of this module.
 */
export const syncVersion = (): string =>
  String((globalThis as { __docsSyncedAt?: number }).__docsSyncedAt ?? 0)

export const markDocsSynced = (): void => {
  ;(globalThis as { __docsSyncedAt?: number }).__docsSyncedAt = Date.now()
}
