/**
 * Cache tag for the synced merch catalogue.
 *
 * Deliberately dependency-free and in its own module: the Merch block reaches
 * for this tag, and the block is in the layout's module graph via
 * `RenderBlocks`. Importing it from the collection's hooks would drag
 * `next/cache` and the collection wiring — and, transitively, the Payload
 * config's server-only dependencies — into a bundle that has no business
 * holding them.
 *
 * Dropped by the sync job when a run actually changed something, and by the
 * collection's hooks when an editor curates a product.
 */
export const MERCH_TAG = "merch"
