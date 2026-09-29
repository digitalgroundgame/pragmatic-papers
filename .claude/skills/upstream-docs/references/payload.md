# Payload docs (`payloadcms/payload`, `docs/`)

Fetched at the tag of the installed Payload version, so these describe what we run. Site:
`https://payloadcms.com/docs/<path without .mdx>`.

| Question                                                                             | Path                                                                                         |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Collection config options, globals                                                   | `docs/configuration/collections.mdx`, `globals.mdx`, `overview.mdx`                          |
| Environment variables in config and the admin bundle                                 | `docs/configuration/environment-vars.mdx`                                                    |
| A field type's options (`relationship`, `blocks`, `tabs`, `join`, `slug`, `upload`…) | `docs/fields/<type>.mdx`, shared options in `docs/fields/overview.mdx`                       |
| Hooks: which run when, args, `context`                                               | `docs/hooks/collections.mdx`, `fields.mdx`, `globals.mdx`, `context.mdx`                     |
| Access control, field-level access                                                   | `docs/access-control/collections.mdx`, `fields.mdx`, `overview.mdx`                          |
| Drafts, autosave, versions, scheduled publish                                        | `docs/versions/drafts.mdx`, `autosave.mdx`, `overview.mdx`                                   |
| Queries: `where`, `depth`, `select`, pagination                                      | `docs/queries/`                                                                              |
| Local API (`payload.find`…), `overrideAccess`, outside Next.js                       | `docs/local-api/overview.mdx`, `access-control.mdx`, `outside-nextjs.mdx`                    |
| Postgres adapter, `push`, `afterSchemaInit`                                          | `docs/database/postgres.mdx`                                                                 |
| Migrations (`migrate:create`, prod runs)                                             | `docs/database/migrations.mdx`                                                               |
| Transactions and `req`                                                               | `docs/database/transactions.mdx`                                                             |
| Lexical: features, blocks, custom features                                           | `docs/rich-text/official-features.mdx`, `blocks.mdx`, `custom-features.mdx`                  |
| Lexical → HTML/JSX/Markdown (our RSS/Substack converters)                            | `docs/rich-text/converting-html.mdx`, `converting-jsx.mdx`, `converters.mdx`                 |
| Jobs queue, tasks, schedules (our daily syncs)                                       | `docs/jobs-queue/`                                                                           |
| Plugins we use: SEO, redirects, nested docs, form builder, search                    | `docs/plugins/seo.mdx`, `redirects.mdx`, `nested-docs.mdx`, `form-builder.mdx`, `search.mdx` |
| Uploads and storage adapters (S3/Supabase)                                           | `docs/upload/overview.mdx`, `storage-adapters.mdx`                                           |
| Live preview                                                                         | `docs/live-preview/`                                                                         |
| Admin UI: custom components, views, React hooks                                      | `docs/custom-components/`, `docs/admin/react-hooks.mdx`                                      |
| Building without a database, deployment                                              | `docs/production/building-without-a-db-connection.mdx`, `deployment.mdx`                     |
| Upgrade notes between versions                                                       | `docs/migration-guide/`                                                                      |

The package source is next to the docs if you add its path, e.g. `packages/db-postgres` or
`packages/richtext-lexical`, when the docs don't say what an option really does.
