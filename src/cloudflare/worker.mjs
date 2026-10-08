/* eslint-disable @typescript-eslint/explicit-module-boundary-types, import/no-anonymous-default-export -- TODO(before merge): temporary /__db-debug */
// The Cloudflare Worker's entry (`main` in wrangler.jsonc): OpenNext's worker, built into
// `.open-next/` by `pnpm build:worker`, behind `withOrigin`.
import pg from "pg"

import openNext from "../../.open-next/worker.js"
import { logErrorCauses, withOrigin } from "./origin"

export { DOQueueHandler } from "../../.open-next/worker.js"

logErrorCauses()

const handler = withOrigin(openNext)

// TODO(before merge): remove. Reports which database Hyperdrive reaches.
async function dbDebug(request, env) {
  if (request.headers.get("authorization") !== `Bearer ${env.PAYLOAD_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  const client = new pg.Client({ connectionString: env.HYPERDRIVE.connectionString })
  try {
    await client.connect()
    const { rows } = await client.query(
      `select current_database() as database, current_user as "user",
        inet_server_addr()::text as server, current_setting('search_path') as search_path,
        (select count(*)::int from information_schema.tables where table_schema = 'public') as public_tables,
        (select string_agg(nspname, ',') from pg_namespace where nspname not like 'pg_%') as schemas,
        version(),
        (select string_agg(datname || '=' || pg_size_pretty(pg_database_size(datname)), ', ')
          from pg_database where not datistemplate) as databases,
        inet_server_port() as port, pg_postmaster_start_time()::text as started`,
    )
    return Response.json(rows[0])
  } catch (error) {
    return Response.json({ error: String(error), cause: String(error?.cause) }, { status: 500 })
  } finally {
    await client.end().catch(() => undefined)
  }
}

export default {
  fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/__db-debug") return dbDebug(request, env)
    return handler.fetch(request, env, ctx)
  },
}
