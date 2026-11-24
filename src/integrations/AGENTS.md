# Integrations

## Integrations

`src/integrations/` is where an outside service lives: a GitHub repository we
sync data from, the Shopify store behind the merch catalogue, and — as they are
brought across — Listmonk, Google, the rest.

- An integration is one **connection**, not a vendor. Two GitHub repositories
  read with two tokens are two connections. Each is declared once in
  `src/integrations/index.ts`, and a feature imports the one it needs by name.
- The shared contract (`types.ts`) is only identity, the environment variables
  it needs, and `integrationStatus()`, which reports which are missing **by
  name, never by value**. Secrets stay in the environment; nothing here writes a
  credential to the database (issue #912 has the reasoning).
- What a connection _does_ is its own API. `githubRepo()` offers `filesAt(ref)`,
  `latestRelease()` and `filesFromRelease()`, all producing a `FileSource` —
  the seam that lets a feature read files without knowing whether they came from
  an archive, a repository or a fixture. Don't invent a common `sync()`.
- A job that needs credentials asks the connection whether it is configured and
  skips with `describeStatus()` when it is not, rather than reading
  `process.env` itself.

- Settings that aren't secrets (a channel, an account handle) can live in the
  admin's **Integrations** global (`src/globals/Integrations/config.ts`): the
  feature reads the global and passes the value to the connection's method,
  which falls back to its variable. The global's status table lists every
  connection in `INTEGRATIONS` and the variables it's missing.

Adding one: declare the connection in `src/integrations/index.ts`, put its
client under `src/integrations/<service>/`, and have the feature import it.
Progress and the open questions live on issue #912.
