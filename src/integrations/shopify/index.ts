import { readShopifyEnv } from "@/jobs/syncShopifyProducts/logic"

import type { Integration } from "../types"

/**
 * The Shopify store the merch catalogue is synced from.
 *
 * Only the connection's half is here so far: who it is, what it needs, and whether it is
 * usable. The Storefront client and the product sync still live in
 * `jobs/syncShopifyProducts`, and reading `readShopifyEnv` from there rather than
 * re-implementing the check is deliberate — two answers to "is Shopify configured?" would
 * eventually disagree, and the one the sync actually runs on is the true one.
 *
 * Moving the client under this connection is the next step, not this one: the contract in
 * `../types` is worth shaping against two services that have nothing in common before
 * anything is rehomed to fit it.
 */
export const shopifyStore: Integration = {
  id: "shopify-store",
  label: "Shopify store",
  service: "Shopify",
  describe: () => {
    const config = readShopifyEnv()
    return config ? `shopify:${config.domain}` : "shopify:(no store configured)"
  },
  required: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_ACCESS_TOKEN", "SHOPIFY_API_VERSION"],
  // Set is not the same as usable: the domain has to parse as a host, which is the check the
  // sync itself makes before it runs.
  isConfigured: () => readShopifyEnv() !== null,
}
