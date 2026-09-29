# Cloudflare docs (`cloudflare/cloudflare-docs`, `src/content/docs/`)

Site: `https://developers.cloudflare.com/<path without .mdx>/`. Pages are MDX; `<Render file="x"
product="y" />` pulls in `src/content/partials/y/x.mdx`. Partials for the default products are
checked out; add `src/content/partials/<product>` for others, and
`src/content/docs/<product>` for a product not listed here.

| Question                                                                         | Path under `src/content/docs/`                                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Turnstile widget (client), our contact/newsletter forms                          | `turnstile/get-started/client-side-rendering/`, `turnstile/get-started/index.mdx`                                                           |
| Validating a Turnstile token on the server (siteverify)                          | `turnstile/get-started/server-side-validation.mdx`                                                                                          |
| Turnstile test keys, errors, rotating the secret                                 | `turnstile/troubleshooting/testing.mdx`, `turnstile/troubleshooting/client-side-errors/`, `turnstile/troubleshooting/rotate-secret-key.mdx` |
| What Cloudflare caches by default, `Cache-Control`, revalidation                 | `cache/concepts/`, `cache/how-to/`                                                                                                          |
| Cache rules, purging                                                             | `cache/how-to/cache-rules/`, `cache/how-to/purge-cache/`                                                                                    |
| Redirect, transform, origin, configuration rules                                 | `rules/`                                                                                                                                    |
| SSL/TLS modes, edge certificates                                                 | `ssl/`                                                                                                                                      |
| DNS records, proxied vs. DNS-only                                                | `dns/`                                                                                                                                      |
| Web Analytics and the injected RUM beacon (`/cdn-cgi/rum`, seen in Sentry, #855) | `web-analytics/get-started/rum-beacon.mdx`, `web-analytics/`                                                                                |
| WAF and bot rules blocking a request                                             | `waf/`                                                                                                                                      |
| Cloudflare concepts (proxy, IPs, headers like `CF-Connecting-IP`)                | `fundamentals/`                                                                                                                             |

Paths ending in `/` are directories: list them; some products' layout changes between commits.
