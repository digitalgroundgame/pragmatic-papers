# AGENTS.md

This file provides guidance to tools like Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pragmatic Papers** is a Next.js 15 website with Payload CMS 3 as the headless CMS. PostgreSQL database via Docker, Drizzle ORM (managed by Payload).

## Commands

### Development

- `pnpm dev` — starts everything in Docker Compose (Postgres + Next.js dev server on port 8000)
- `pnpm dev:db-nuke` — stop Postgres and delete its volume (`docker compose down -v`), wiping the entire data directory. Use this after a Postgres major-version bump or whenever the local data is corrupt; the next `pnpm dev` recreates a fresh cluster and Drizzle push re-syncs the schema
- `pnpm dev:db-fresh` — bring Postgres up and rebuild the schema by re-running all migrations from scratch (`payload migrate:fresh`). Unlike `dev:db-nuke`, this keeps the volume and exercises the committed migration files (the same path prod uses), so it surfaces migration drift that Drizzle push masks in dev
- `pnpm dev:db-seed` — bring Postgres up, seed it from the terminal, and stop it again. Runs the same `seed()` as the admin dashboard's "Seed your database" button, so it first deletes **every** article, volume, page, media file, topic, map asset, interactive, form and form submission (not just seeded ones), the seed users, and the recommendation rankings, then syncs the help docs in `src/docs/` back in. Drizzle push builds the schema on an empty database, so it works straight after `dev:db-nuke`. It refuses to run unless `DATABASE_URI` points at localhost and `USE_LOCAL_STORAGE=true` (override with `SEED_ALLOW_REMOTE=true`), and exits 1 if you decline Drizzle's data-loss prompt. Stop `pnpm dev` first: this command stops the Postgres container it shares.
- `pnpm showcase <pr-number | staging | url> (<slug...> | --all) [--draft]` — push feature articles from the catalog in `src/endpoints/seed/showcase.ts` to a live site through its REST API, as `SHOWCASE_EMAIL` / `SHOWCASE_PASSWORD` (an account with an author role). A PR number means its `pr-<n>.pragmaticpapers.com` preview; `staging` means `SHOWCASE_STAGING_URL`, and pushes drafts. Only adds articles whose slug is missing; deletes nothing. A PR with the `showcase` label or a `Showcase: <slug...>` line in its description (the workflow keeps the two in sync; the label alone inserts a line naming the articles the PR adds to the catalog) gets them pushed to its preview after every deploy by `.github/workflows/showcase.yml`, which then turns that line into links to them, titled, at the top of the description, and can also be run by hand for a PR (the articles join that line, which opts the PR in) or staging. Nothing is pushed by default: when a PR adds a seeded article to that catalog, opt it in by adding the `showcase` label or putting `Showcase: <slug>` in its description

### Quality Checks

- `pnpm lint` — ESLint across the project
- `pnpm lint:ci` — lint with `--max-warnings 0` (used in CI)
- `pnpm lint:fix` — auto-fix lint issues
- `pnpm format` / `pnpm format:fix` — Prettier check/fix
- `pnpm check-types` — TypeScript type checking

### Testing

- `pnpm test` — run all tests (Vitest), stories included (they need Playwright's Chromium: `pnpm exec playwright install chromium`)
- `pnpm test:unit` — run unit tests
- `pnpm test:storybook` — run every Storybook story in headless Chromium: its `play` function, then an axe check (see [Storybook](#storybook))
- `pnpm storybook` — Storybook dev server on port 6006; `pnpm storybook:build` builds it into `storybook-static/`
- `pnpm test:integration` — run integration tests against a throwaway Postgres in Docker (see [Test databases](#test-databases))
- `pnpm test:e2e` — run Playwright E2E tests against a throwaway Postgres in Docker (see [Test databases](#test-databases)). Functional assertions only; visual changes are reviewed in Storybook and the PR's site preview (see `tests/e2e/README.md`). CI runs the suite in the merge queue, on PRs into `main`, and on a PR into `dev` only once it has the `e2e` label
- `pnpm test:unit:coverage` — run unit tests with V8 coverage report (outputs `coverage/coverage-summary.json` and `coverage/coverage-final.json`). CI's coverage report adds the stories' coverage: the Unit tests and Storybook jobs each upload a `coverage-final.json`, and the Coverage job's `scripts/merge-coverage.ts` adds the stories' hits onto the unit run's map, matching entries by start line (the two transforms disagree on columns, so istanbul's own merge would count them twice). Integration tests aren't counted
- `pnpm test:coverage` — run all tests with V8 coverage report (full picture for local inspection)
- `pnpm test:unit -u` — regenerate snapshot baselines after intentional UI changes
- `pnpm coverage:report` — post the coverage section of CI's PR comment locally (requires `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_EVENT_PATH`)
- `pnpm bundle-size` — measure the gzipped client JS and CSS each public page loads, from the build in `.next` (run `pnpm build` first), and compare it with dev's last measurement when `BASE_BUNDLE_SIZE_PATH` names one (see [Page speed](#page-speed))
- `pnpm analyze` — Turbopack's bundle analyzer, in the browser (it compiles but doesn't leave a build behind): each route's client and server modules, and the import chain that brings each one in. `pnpm analyze --output` writes it to `.next/diagnostics/analyze/` instead, which the next `pnpm build` deletes
- `pnpm lighthouse` — seed a throwaway database, build and serve as `pnpm test:e2e` does, then run Lighthouse's performance audit on a few seeded pages; reports land in `lighthouse-results/`. Set `BASE_LIGHTHOUSE_PATH` to a `summary.json` from an earlier run to compare with it (see [Page speed](#page-speed))

### Test databases

`pnpm test:integration`, `pnpm test:e2e` and `node scripts/check-pending-migrations.mjs`
get their database from `startTestDatabase()` in `scripts/test-db.mjs`. They never read
`DATABASE_URI` (that's your dev database in `.env`); they only set it for the Payload
processes they start.

- By default it `docker run`s `postgres:17-alpine` on a random localhost port and removes
  it on exit, Ctrl-C or SIGTERM. A container left by a `kill -9` is swept by the next run.
- It pulls Docker Hub's official image through Amazon's mirror,
  `public.ecr.aws/docker/library/`, as `docker-compose.yml` and both Dockerfiles do:
  Docker Hub rate-limits anonymous pulls. CI pulls its copy in GHCR instead
  (`ghcr.io/digitalgroundgame/postgres:17-alpine`, set by `TEST_DB_IMAGE` and used by
  every Postgres service), logged in with the job's `GITHUB_TOKEN`, because GitHub's
  shared runners share their IPs and ran out of ECR Public's anonymous pulls too.
  `.github/workflows/ci-images.yml` refreshes that copy weekly, along with a GHCR copy of
  the Node image the CI Dockerfile builds on (`ghcr.io/digitalgroundgame/node`), which
  `build-app-image` pulls logged in, falling back to `mirror.gcr.io` (then ECR Public)
  until the copy exists.
- Integration and E2E start from a **pre-migrated snapshot image**
  (`pragmatic-papers-test-db:<hash>`, keyed on `src/migrations/**` and the Postgres image),
  so they skip `payload migrate` until a migration changes; a miss migrates once and commits
  a new one. The pending-migrations check always replays from scratch, and CI (`CI` set)
  never uses a snapshot. `docker image rm` the tags to force a fresh migrate.
- `TEST_DATABASE_URI` points them at an existing database instead (CI's E2E jobs, whose
  containers can't start their own). It is refused if it names the same database as
  `DATABASE_URI` in `.env`.

### Build & Payload

- `pnpm build` — build the application
- `pnpm build:worker` / `pnpm start:worker` — build the public site as a Cloudflare Worker with OpenNext (webpack, without the admin panel) and run it in `wrangler dev`. Everything Worker-specific is behind `OPENNEXT_BUILD=true`, so `pnpm build` is unchanged; see `src/cloudflare/README.md`
- `pnpm payload generate:types` — regenerate Payload TypeScript types
- `pnpm payload generate:importmap` — regenerate Payload import map
- `pnpm payload migrate` — run database migrations
- `pnpm migrate:create "migration_name"` — create a new migration. Pass a name as the first argument.
- `pnpm migrate:index` — rewrite `src/migrations/index.ts` from the migration files, as `migrate:create` writes it. Two branches that each add a migration both append to that file; `.gitattributes` gives it a merge driver (`scripts/migrations-index.ts`, registered in your clone by `pnpm install`) that keeps both, so a merge doesn't stop there. CI's Static checks run `pnpm migrate:index --check`
- `pnpm generate:importmap` after a merge conflict in `src/app/(payload)/admin/importMap.js`: it's generated, so regenerate it rather than resolving the conflict by hand

## Architecture

### Project Structure (`src/`)

- **`payload.config.ts`** — Central Payload CMS configuration
- **`collections/`** — Payload collections: Articles, Pages, Users, Volumes, Media, Categories, Webhooks
- **`blocks/`** — Content blocks used in Lexical rich text: Banner, Code, Content, Footnote, Math, MediaBlock, SocialEmbed, etc.
- **`fields/`** — Custom Payload fields: colorPicker, menu, numberSlug, link, footnotes, button, defaultLexical. New fields should include `Field` in the name (e.g. `buttonField`, `menuField`).
- **`access/`** — Access control: `roles.ts` (e.g., `admin`, `editor`, `writer`) and `policies.ts` (e.g., `isSelfOrAdmin`, `isCreatedByOrEditor`, `isPublishedOrStaff`, `isDraftOrEditor`)
- **`app/(frontend)/`** — Public-facing Next.js pages using App Router
- **`app/(payload)/`** — Payload admin panel routes
- **`components/`** — Reusable React components for layouts, pagination, etc; `components/ui/` uses shadcn/ui;
- **`providers/`** — Context providers (MathJaxProvider)
- **`utilities/`** — the library every feature and plugin builds on (see [Utilities](#utilities))
- **`data/`** — server reads shared across pages: `getPayloadClient` (`payload.ts`), `getGlobal` (`globals.ts`), the `query*BySlug` helpers (`queries.ts`)
- **`hooks/`** — shared React hooks (`useInView`, `useDebounce`, shadcn's `use-mobile`) and the Payload hooks several collections share (`purgeEdgeCache`, `revalidate*`)
- **`plugins/`** — `index.ts` configures the third-party Payload plugins; each folder beside it is one of ours (see [Our plugins](#our-plugins))
- **`integrations/`** — the outside services we read from, one **connection** per entry (see below)
- **`migrations/`** — Drizzle database migrations

### Path Aliases

- `@/*` → `src/*`
- `@payload-config` → `src/payload.config.ts`

### Payload CMS Patterns

- **Collections** define schema, access control, hooks, and admin UI in a single config object
- **Hooks**: Collections support lifecycle hooks (`beforeChange`, `afterChange`, `beforeDelete`, `afterDelete`, `beforeRead`, `afterRead`, `beforeValidate`) for custom logic like data transformation, side effects, and validation
- **Indexing**: Payload handles database indexing automatically based on collection config — fields with `index: true` or `unique: true` get indexed without manual migration
- **Access control**: Each collection defines `access` functions (`create`, `read`, `update`, `delete`) that determine permissions per operation
- **Blocks & Fields**: Custom block types and field types are defined as configs and registered in `payload.config.ts`; Payload auto-generates TypeScript types from them via `generate:types`

### Payload Globals

- **Header** (`slug: 'header'`) — nav items, action button (admins), and a **Ticker** tab: admins switch the ticker on, and while it's on editors see the posts its sources hold now, each with a Hide button that adds its link to the hidden posts (or paste a link). Editors can save the global, but every field except the hidden posts is admin-only. Which accounts the ticker reads is in **Integrations** (admin-only); revalidated via `revalidateHeader` hook
- **Footer** (`slug: 'footer'`) — nav items; revalidated via `revalidateFooter` hook
- **Settings** (`slug: 'site-settings'`, the `SiteSettings` global) — admin-only; its `experiments` group switches beta features on per environment; revalidated via `revalidateSiteSettings` hook
- **Plugins** (`slug: 'plugins'`) — admin-only: the installed plugins (`registeredPlugins`), and the switches of those that offer one; revalidated via `revalidatePlugins` hook
- **Newsletter** (`slug: 'newsletter'`) — admin-only, stores nothing: its page (`NewsletterView`, replacing the edit view) shows Listmonk's subscriber counts, newest signups and latest campaigns
- Fetched via `getGlobal('header' | 'footer', depth)` from `@/data/globals`, which caches with `unstable_cache` under the tag `global_<slug>`

### Experiments

A beta feature that should run on staging before production goes behind a
checkbox in the Settings global's `experiments` group
(`src/globals/SiteSettings/config.ts`). Each environment has its own database,
so each has its own switches; PR previews start with staging's. To add one:

1. Add a `checkbox` to the `experiments` group, `defaultValue: false`, then
   run `pnpm payload generate:types` and `pnpm migrate:create`.
2. Turn it on in the seed's "Enabling experiments..." step
   (`src/endpoints/seed/index.ts`), so local dev shows it.
3. Gate **every** entry point with
   `await isExperimentEnabled("<name>")` from
   `@/globals/SiteSettings/isExperimentEnabled`: routes call `notFound()`
   (API routes return 404), links and buttons aren't rendered, sitemaps come
   back empty, and jobs skip with a log line.

Saving the global clears Next's cache, so the origin answers with the new
switch on the next request, without a redeploy. Cloudflare's edge copy of
every public page is purged too, when the deployment has
`CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_PURGE_TOKEN` (see
[Edge cache](#edge-cache-cloudflare)); without them anonymous readers can
see the old answer until the edge's copy expires (10 minutes, or up to a day
served stale). When the feature graduates, delete the checkbox and the checks.

### Help docs and notifications

A release that changes what staff do in the admin ships a help doc in the same
PR. Docs are the `docs` collection (`src/plugins/docs/`, the docs plugin),
served at `/docs/<slug>`, so they can hold blocks and images like an article.
`/docs` shows the home doc (`src/docs/home.md`), and `/docs/whats-new` lists every
doc, newest first. The sidebar groups sections under four areas (`DOC_AREAS`), by
what the reader is doing: Reading (readers' features), Writing (articles, blocks,
media), Editing (pages, volumes, moderation, site settings) and Development
(the GitHub wiki, for now); an area shows once it has docs. There's no Admin area:
an admin-only doc goes where its subject does, and one whose `audience` leaves out
writers sits in Editing (`repoDocs.test.ts` checks). Moving a doc to another
section's folder changes its hash, so sites that have it are offered the move as a
draft like any other change. Each doc ends with
Previous and Next links in the sidebar's order. The ones a release ships live in
the repo as Markdown, a folder per sidebar section (`DOC_SECTIONS` in
`src/plugins/docs/sections.ts`): `src/docs/<section>/<slug>.md`, with the pictures
it shows beside it, each named for the doc (`<slug>-hero.webp`,
`<slug>-drawer.webp`). Once per deploy,
`/next/revalidate-all` (which `start.sh` calls when a deploy goes live) seeds that
site's database with each doc whose slug it doesn't have yet, as a **draft**,
converting the Markdown with the docs editor and uploading its pictures to Media
(`syncRepoDocs`). Code never publishes, overwrites the published version or deletes,
so a doc belongs to the site's editors from the moment it arrives. A draft is on
neither `/docs` nor the bell until an editor publishes it. When a doc's file changes
(its content hash, which covers `revisedAt` and its pictures), a site that already
has the doc gets the new copy as a **new draft version** (`payload.update` with
`draft: true`, which writes a version and leaves the published doc alone): the admin
shows the doc as Changed, and an editor compares it in the Versions tab, then
publishes, edits or discards it (Revert to published). `planRepoDoc` (`syncDocs.ts`)
decides. A doc whose latest version is an editor's own draft is skipped and logged,
not recorded, so a later deploy offers the change once that draft is published or
discarded; a suggestion of the deploy's own that nobody has touched is superseded by
a newer one. Each revision offered is recorded (`markOffered`, beside `markSeeded`
in `src/utilities/seedOnce.ts`) with the version it was saved as, so a discarded
one isn't offered again. A doc that has no offer recorded (one seeded before
offers began) is offered the repo's copy when it differs from the `sourceHash` the
doc was saved with; one an editor wrote, with no `sourceHash`, records the repo's
current hash as offered and gets only later changes. Each doc it seeds, or finds already there, is recorded in Payload's
key-value store (`markSeeded`, which other
deploy-seeded content uses too), so one an editor deletes stays deleted and is never
recreated (`DOCS_SYNC=false` turns the sync off, as the staging Worker does: it reads
staging's database and has no `src/docs/` of its own). `pnpm dev:db-seed` seeds
them locally, published, deleted or not.

A doc's front matter (`src/plugins/docs/docFile.ts`) holds its `title`, a
`navTitle` of 24 characters at most for the sidebar, a `summary` of a sentence
or two (the bell shows it), `publishedAt` (the day the release reaches
production; for a feature that shipped earlier, the day it did), `revisedAt`
when a later release changes it (shown as "Updated …" beside the date; the bell
keeps it under `publishedAt`), `heroImage` and `heroAlt` (1200×630, the bell's
thumbnail, the link preview's image and the banner above the doc's title; optional,
but give a doc one where a picture helps) and, for a
doc only some roles need, `audience` (e.g. `[editor]`; admins and chief editors
see every doc). `audience` only decides who the bell tells: every published doc
is public at /docs, as the repo is. The body is Markdown the docs editor can
hold (headings, lists, bold, italic, inline code, links), plus pictures on a
line of their own, `![alt](<slug>-picture.webp)`, which become Media blocks.
Link to other pages by URL. Other blocks can't be written in Markdown.
`src/plugins/docs/__tests__/repoDocs.test.ts` and `markdown.test.ts` check every
doc.

To write one in the local admin instead (**Help → Docs**), `pnpm docs:export
<slug>` writes it into its section's folder, copying the pictures it uses beside
it.

The bell lists each doc under its `publishedAt`, newest first.

Editors can change any doc in the admin, seeded or not. Readers' pages and the
bell read docs through `unstable_cache` with the `docs` tag, which saving a doc
clears, along with the edge cache.

The bell beside the avatar in the admin header is the notifications plugin
(`src/plugins/notifications/`). Features plug into it with a
`NotificationSource` (`types.ts`): a type users can mute, and `itemsFor(user)`,
which decides who sees what (help docs come from `docsNotifications()`, staff
only). Register a source in `src/plugins/index.ts`. Each user's read items and
muted types are kept in their Payload preferences (`payload-preferences`, key
`notifications`); items dated before the account was made don't count as
unread.

A doc can come with a guided tour of the admin (the tours plugin,
`src/plugins/tours/`): driver.js popovers that walk staff through the real
screens, page by page. Tours are code, in `TOURS` (`registry.ts`), and ship with
the release that changes the screens they point at, since their steps name
Payload's stable hooks (`#card-articles`, `.tabs-field__tabs`). A link from
`tourHref(key)` (`/admin?tour=<key>`) starts one; the step it's on is kept in
sessionStorage, so it carries on across page changes, and a step whose element
never appears ends it quietly. A doc names its tour in `tour`, and once the doc
is published the bell offers it as **Show me** beside **Read more** (any
`NotificationItem` can, with `showMe`), as does the doc's page. After changing a screen a tour points at, run
the tour locally.

The three plugins are betas, each with its switch on **System → Plugins** (`isPluginEnabled`),
passed from `src/plugins/index.ts` through each plugin's `enabled` option, so
the plugins never read the switches themselves. With `docs` off, `/docs` pages 404,
their sitemap is empty and the bell leaves docs out (a source's `enabled`); the Docs collection and the
deploy's docs sync carry on, so docs are ready when it's switched on. With
`notifications` off there's no bell; with `tours` off, `TourGate` doesn't mount
the tour provider and no Show me button appears.

The bell is built from the site's shadcn components (`src/components/ui/`).
Payload 3 has no Tailwind of its own, so `NotificationsMenu.css` brings in
Tailwind's theme and only the utilities those files use, without preflight, and
maps the shadcn tokens onto Payload's theme variables under `html[data-theme]`.
Another admin component on shadcn adds its files to that CSS's `@source` list.

### Edge cache (Cloudflare)

Public pages are cached at Cloudflare's edge (`s-maxage=600`,
`stale-while-revalidate=86400`, from `next.config.ts`). A `revalidate*` hook
that changes what anonymous readers see calls
`purgeEdgeCache(payload.logger, "<reason>")` (`src/hooks/purgeEdgeCache.ts`)
after its own `revalidatePath` / `revalidateTag`, and only when
`context.disableRevalidate` is unset. It purges this deployment's hostname
(production, staging and previews share a zone), batches a burst of saves into
one request, returns at once, and logs and skips when the `cloudflareCache`
connection isn't configured. When the `cloudflareWorkerCache` connection is
configured (`WORKER_URL`, on the Coolify app a Cloudflare Worker reads from), the
same flush first clears that Worker's cache through its `/next/revalidate-all`:
only the `paths` the hook passes (the ones it revalidated) and, with `shared`, every
page listing articles, volumes or contributors, or every page when it passes neither
(the Worker tags each page it keeps, `edgeCacheTags`). A hook for content readers see
calls `revalidateForReaders` (`src/hooks/revalidateForReaders.ts`) rather than
`revalidatePath`, `revalidateTag` and `purgeEdgeCache` itself: it revalidates the paths and
tags here, purges them (and any `purgeOnly` paths, for pages that render per request) from
the edge, and tells the Worker to revalidate exactly those in its own Next cache, which it
otherwise empties whole. It then requests the same most-read pages through the Worker's URL in the background
(`warmWorkerSoon`), since a Worker renders a page on a cold isolate in seconds.
A new hook for content readers see should call it too.
On a collection with drafts, a hook decides what a save changed with `readersChange`
(`src/utilities/readersCopy.ts`, with `rememberReadersCopy` first in the collection's
`beforeChange`), not `previousDoc`: Payload hands hooks the latest version, which is an
autosaved draft once an editor types, so `previousDoc` makes an autosave look like an
unpublish and hides a rename made in drafts.
A deploy purges too: `start.sh` waits until the site's public URL is answered by the
new container (`/next/purge-edge` names its `INSTANCE_ID`), so the old container can't
refill the edge with the previous release's pages, then POSTs `/next/purge-edge`, which
purges and then requests the most-read pages through the public URL (`warmPages`: the
section indexes, feeds, sitemap index and the newest volume's articles) so the first readers
find them cached. A warm-up failure only logs a warning. A deploy leaves the Worker alone
(`{ worker: false }`): its own workflow empties it, then POSTs the Coolify app's
`/next/warm-worker` to warm it.

### Payload Plugins

- **redirectsPlugin** — redirects on pages, volumes, articles (admin currently hidden)
- **nestedDocsPlugin** — nested docs on categories (breadcrumb URLs)
- **seoPlugin** — `generateTitle`, `generateDescription` and `generateURL` for the SEO tab each collection builds itself. A collection must also be listed in the plugin's `collections`, or its Auto-generate buttons get a 403
- **formBuilderPlugin** — form builder (admin currently hidden)
- **s3Storage** — S3/Supabase media storage; falls back to local when `USE_LOCAL_STORAGE=true`

### Our plugins

A feature that could be published one day lives in `src/plugins/<name>/`, shaped like
Payload's own plugins so it can be lifted out without a rewrite:

- `index.ts` exports `<name>Plugin`, and nothing else the app needs. It's made with
  `registerPlugin({ slug, order, manifest, plugin })` (`@/utilities/registerPlugin`): Payload's
  `definePlugin` descriptor plus a `manifest` (name, source, description, `switch`), so
  `<name>Plugin(options)` carries Payload's `slug` and `options`, and its `plugin` gets the
  options and the other plugins (`plugins`). When Payload covers what the manifest does, drop
  that key. The manifest is fixed facts about the plugin; what a site decides goes in options.
  It lists the plugin on the admin's **System → Plugins** page. A package that doesn't describe
  itself is wrapped with `describePlugin` where `src/plugins/index.ts` installs it.
- Every plugin takes `enabled` (checked at runtime; `isPluginOn` reads it) and `disabled`
  (`SitePluginOptions`). Switching a plugin off stops its behavior; its schema stays.
- A plugin that checks `enabled` on each request offers a `switch` in its manifest:
  `pluginSwitches` (`src/globals/Plugins/`) gives it a checkbox on System → Plugins named for
  its slug (a camelCase one), `src/plugins/index.ts` passes `pluginSwitch("<slug>")` as its
  `enabled`, and routes outside the plugin gate on `isPluginEnabled("<slug>")`. A beta's switch
  starts off (`defaultValue: false`), which shows a **Beta** badge; when it graduates, flip the
  default rather than deleting the switch. This replaces an experiment in Settings for a
  feature that's a plugin; anything else stays an experiment.
- `types.ts` holds `<Name>PluginConfig`, extending `SitePluginOptions`. Options have defaults,
  and `disabled: true` leaves the schema in place (so migrations don't change) but turns the
  behavior off.
- `collections/`, `hooks/`, `endpoints/` and `components/` as the plugin needs them. Admin
  components are referenced by path through `exports/client.ts` and `exports/rsc.ts`, so
  the import map paths survive a move into a package.
- Whatever is this app's comes in through the options: preview paths, access and roles,
  blocks and fields, side effects like `purgeEdgeCache` (as a callback). Payload comes from
  `req.payload` or the `payload` a hook is handed, never `@/data/payload`.
- `@/utilities` may be imported directly: it would ship alongside as a shared package.

ESLint enforces the import rules for every folder under `src/plugins/` (`eslint.config.mjs`).

### Collection Conventions

- **File structure**: `collections/<Name>/index.ts` with optional `hooks/` and `components/` subdirectories
- **Hook naming**: `revalidate*` for cache invalidation, `generate*`/`populate*` for data transformation, `pushTo*`/`check*` for side effects
- **Admin sidebar**: every collection and global sets `admin.group` to one of Content, Site, Interactives, Store, System or Help, and labels are a single word where one reads clearly (`labels`/`label`, never the slug). Groups appear in the order of their first entry in `payload.config.ts`
- **Tabs pattern**: Content + SEO tabs; SEO tab uses standard fields (`OverviewField`, `MetaTitleField`, `MetaImageField`, `MetaDescriptionField`, `PreviewField`)
- **Versions config**: `drafts.autosave: true`, `schedulePublish: true`, `maxPerDoc: 50`
- **Live preview**: `generatePreviewPath()` for `admin.livePreview.url` and `admin.preview`
- **Breadcrumbs**: a page builds its trail (`Crumb[]`, the steps after Home) from the documents it loaded and passes the same list to `<Breadcrumbs items={...} />` and `buildBreadcrumbJsonLd`. Labels are titles, never derived from slugs, and nothing reads the request. A nested collection (the nested-docs plugin) builds it with `nestedDocsTrail(doc.breadcrumbs, basePath)` from `@/components/Breadcrumbs`
- **Media references**: media used by published content can't be deleted until it's detached (the Media **References** tab). An upload field or a block that holds media must be listed in `SOURCES` (`src/collections/Media/references/collectMediaReferences.ts`), or media it uses can be deleted without warning

### Block Conventions

- **File structure**: `blocks/<Name>/config.ts` (Payload config) + `blocks/<Name>/Component.tsx` (React component)
- **Two rendering systems**: `RenderBlocks` renders page layout blocks (Content, CTA, MediaBlock, Form, VolumeView); `RichText` renders Lexical inline/rich-text blocks (Banner, Code, Math, Footnote, SocialEmbed, SquiggleRule)
- **Heavy client code loads lazily**: `RichText` and `RenderBlocks` import every block, so whatever a block's client component imports ships on every page that renders rich text, the footer included. A client component with a sizeable dependency (a highlighter, a carousel, a form library, a player) is imported through a sibling `*.lazy.tsx`: a `"use client"` file that wraps it in `next/dynamic` (`blocks/Code/Component.lazy.tsx`), so only pages that render it download it. The wrapper has to be a client file: `next/dynamic` in a Server Component doesn't split the code. Server rendering is unchanged. Unit tests get the real component (`vitest.setup.ts` maps each `.lazy` module to it), and stories wait for it with `findBy*`. `pnpm bundle-size` shows what a page loads up front
- **Menus and toggles load on first use**: the header's sheets, mega menu and mode toggles are on every page, and most readers never open them. Their `*.lazy.tsx` wrappers render through `LoadOnInteraction` (`src/components/LoadOnInteraction`): markup that looks the same (the trigger button, or the menu's links) until the reader points at, touches, focuses or clicks it, then the base-ui component, with the click replayed and focus kept. Keep the layouts' server components from importing anything that imports base-ui's dialogs or menus (`ui/sheet`, `ui/dropdown-menu`, `ui/navigation-menu`): its client code would be back in every page's first-load JavaScript. `pnpm bundle-size` shows it
- **Feed converters**: the RSS feeds (`/articles/feed.xml`, `/volumes/feed.xml`) and the Substack import feed render article content and volume editor's notes to HTML. A block's non-React renderings live in **`blocks/<Name>/converters.ts`**, one function per output **format**, named for the format rather than the feed (`timelineToHTML`, `displayMathToCode`). Each takes the block's fields plus a `FeedContext` (`src/utilities/feedHTML.ts`: `siteUrl`, `pageUrl`, `richTextToHTML` for nested rich text) and returns plain semantic HTML: absolute URLs, no inline styles, and every CMS value through `escapeHTML`. Shared logic used by several formats, or by `Component.tsx`, goes in the same file (`formatTimelineDate`). `converters.ts` must run in the browser, because Storybook imports it, so no server-only imports. The feed files only map block slugs to the format they want, through `fromBlock`: `createHtmlConverters` (`src/app/(frontend)/feeds/generateRssFeed.ts`) and, for article content, `createSubstackConverters` (`src/app/(frontend)/articles/_substack/generateSubstackFeed.ts`). A block added to those editors (or to the rich text inside their blocks) needs a converter, plus:
  - a `__tests__/converters.test.ts` using `toMatchInlineSnapshot()`, fed from `src/stories/fixtures/blocks.ts`
  - a `Feed` story that renders the output through `src/stories/FeedHTML.tsx`, so it gets the axe check

  `src/app/(frontend)/feeds/__tests__/generateRssFeed.converters.test.ts` reads the resolved Payload config and fails, naming what's missing, until every feed has a converter

### Data Fetching Patterns

- Code with a request (hooks, endpoints, access functions, validation, jobs) reads Payload from `req.payload`, inside the request's transaction. Code without one (pages, layouts, route handlers, `generateMetadata`) uses `getPayloadClient` from `@/data/payload`, never `getPayload({ config })`
- Wrap data queries in `React.cache()` for per-request deduplication
- Use `unstable_cache` with cache tags for long-lived caching (globals, redirects, sitemaps)
- Sitemaps: each is a `sitemap.ts` in the folder of the section it lists (Next's metadata convention, served at `/<route>/sitemap.xml`, e.g. `docs/sitemap.ts`), added with a title to `SITEMAPS` in `(sitemaps)/sitemaps.ts`, which `/sitemap_index.xml`, robots.txt and the Feed list block read (that block, `blocks/FeedsList`, lists them and the RSS feeds in `FEEDS` from `feeds/feeds.ts` on the `/feeds` page, a Pages document editors own: a deploy creates it once per site as a draft for an editor to publish, then never touches it again, even once deleted (`STARTER_PAGES` in `collections/Pages/starterPages/`), and the seed creates it published locally). Pages live at the root, so theirs is the root `sitemap.ts` (`/sitemap.xml`), and the index of them all is `/sitemap_index.xml` (`(sitemaps)/sitemap_index.xml`), which robots.txt and Search Console point at; Google News reads `articles/news-sitemap.xml/route.ts`, a route handler (`sitemap.ts` can't write `news:` tags) listing only the last two days' articles, as Google asks. The old `/pages-sitemap.xml`, `/articles-sitemap.xml` and `/volumes-sitemap.xml` redirect permanently in `next.config.ts`
- Always respect `draftMode()` — pass `draft` and `overrideAccess: draft` into Payload queries
- Next.js 15: `params` and `searchParams` are `Promise`s (must be `await`ed)
- Metadata: use `generateMeta({ doc, canonicalPath })` from `@/utilities/generateMeta`
- Static generation: implement `generateStaticParams()` with `overrideAccess: false` and `draft: false`

### Key Patterns

- **Database in dev**: Drizzle "push" mode auto-syncs schema changes — no manual migrations needed during development
- **Styling**: TailwindCSS with CSS variables for theming
- **Content rendering**: Blocks system with Lexical rich text editor; each block has a config and a React component
- **Pre-push hooks**: Husky runs full checks on all files (`lint:fix`, `format:fix`, `check-types`) before pushing
- **Pre-commit hooks**: lint-staged runs ESLint + Prettier on staged files only (fast, ~1-2 seconds)
- **Colocation**: Prefer colocating logic near where it's used. A helper only one feature uses lives with that feature; `src/utilities/` is for what several features share (see [Utilities](#utilities)).
- **Commit trailers**: don't add a `Claude-Session:` trailer (or any other link to an agent session) to commit messages. A `Co-Authored-By:` trailer is fine.
- **Issue and PR numbers in comments**: comments and docs describe the code as it is now; why and when it changed is what `git log` and `git blame` are for. Don't write "added in #970", "before #672" or "see #883" — the sentence should stand on its own. Two exceptions, each a pointer with an exit: an upstream bug a workaround depends on (full URL; remove the workaround when it's fixed), and an **open** issue tracking a known gap or a skipped check (say what to remove when it closes, as `knownContrastIssue` does for #998). When that issue closes, delete the comment and what it guards; never append to it.

### Utilities

`src/utilities/` is the library features and plugins depend on, so it depends on none of them.
A file there may import `@/payload-types` (types), React, Payload and Next types, framework
hooks, and other utilities; ESLint rejects anything app-specific (`@payload-config`,
collections, blocks, components, `@/data`, integrations, `next/headers`). A helper that needs
one of those belongs with its feature, or takes the value as an argument.

Reach for these before writing your own:

- URLs: `docPath(collection, slug)` and `internalDocToHref` (`routes.ts`, the one
  collection-to-path map), `getSiteURL()` / `getClientURL()` / `absoluteURL(path)`
  (`getURL.ts`), `linkHref`, `getMediaUrl`
- Dates and text: `formatLongDate`, `formatTimeAgo` (`formatDate.ts`), `truncate`,
  `formatAuthors`, `getInitials`, `toRoman`
- Narrowing: `isRecord`, `isResolved` / `relationshipId` (`relationships.ts`), `Result`
  (`result.ts`)
- Metadata and feeds: `generateMeta`, `mergeOpenGraph`, `structuredData`, `feedHTML`

### Single sign-on

`src/plugins/sso/` signs people in with Google, Discord or Destiny.gg, behind its switch on
System → Plugins. Better Auth runs the OAuth exchange and keeps its sessions, linked accounts and
OAuth state in three plain tables (`auth_sessions`, `auth_accounts`, `auth_verifications`;
`ssoAfterSchemaInit` declares them, so they aren't collections and don't show in the admin).
Payload keeps the users, their roles and its own email and password login, which stays as the
way in when a provider is down. Its options live in `src/plugins/signIn.ts`, which the comments
plugin and the account page read too.

- **Staff and members share the `users` table, but only staff are Payload's user.**
  `isPayloadUser` (`isStaff`) decides whose session `ssoStrategy` turns into `req.user`; a
  member is anonymous to the admin, the REST API and every access rule, and the `beforeLogin`
  hook refuses them Payload's password login. Code that needs members (comments, `/account`)
  asks `getSignedInUser(req, ssoOptions)` instead of reading `req.user`.
- **Sign-up** makes a `member` (`signUp` in `signIn.ts`): only when the sign-in sends
  `requestSignUp: true` (the comment box and `/account` do, the admin's login page doesn't),
  the `comments` switch is on (System → Plugins), and the provider verified the address. Better Auth inserts
  the row with a random `member-…` slug, and `afterCreate` sets the role through Payload.
  Destiny.gg shares no address, so its sign-up gets a placeholder, `destiny-<id>@no-email.invalid`
  (`placeholderEmail.ts`: `.invalid` can't receive mail, so never send to one), and is
  unverified. Linking Google or Discord later swaps it for the address that provider verified
  (`adoptVerifiedEmail`, from Better Auth's `validateUserInfo`), unless another user has it.
- Any other provider login attaches to the user whose address the provider has verified.
- Signed in, anyone can link more accounts: staff from the **Connections** tab
  of their record (`/admin/account`), members from `/account`. `/api/auth-links` (`endpoints/links.ts`) acts on
  the signed-in user and starts the OAuth through a server-only Better Auth endpoint
  (`linking.ts`). Disconnecting ends the user's other sessions; a member's last sign-in can't
  be disconnected. Destiny.gg's PKCE challenge isn't RFC 7636's, so it's a Better Auth plugin
  (`destiny.ts`) rather than a built-in provider.
- `/api/account` (`endpoints/account.ts`) is the account page's: read it, rename (members),
  and delete the account (members only; staff are deleted by an admin).
- Better Auth's endpoints are Payload endpoints under `/api/auth/*`. The ones that would
  write to the users table (`DISABLED_PATHS`) answer 404.
- The session cookie is `pp-session`, with no `payload-token` in its name, so members get
  cached pages. Staff also get `payload-token-sso` (`payloadUserCookie.ts`), which carries no
  authority: the cache rules that keep signed-in editors off the edge look for it,
  `next.config.ts` and the Worker's cache (`PERSONAL_COOKIES` in `src/cloudflare/edgeCache.ts`)
  by name, and Cloudflare's rule because the name contains `payload-token`. Rename either
  everywhere or not at all.
- `staffByDefault` (`src/plugins/staffByDefault.ts`, the last plugin) gives every access rule a
  collection or plugin leaves out to staff, where Payload's default is any logged-in user, so a
  forgotten rule can't reach members if one ever becomes `req.user`.
- The provider credentials are the `googleSignIn`, `discordSignIn` and `destinySignIn`
  connections (`src/integrations`); a provider's button appears once both of its variables
  are set.
- `tests/integration/sso.test.ts` runs whole Discord sign-ins and sign-ups against the
  database, with Discord stubbed.

### Comments

`src/plugins/comments/` puts comments under articles, behind its switch on System → Plugins, which
needs Single sign-on on too (readers have no other way to sign in). It
doesn't sign anyone in: `currentUser` (here `getSignedInUser`) says who is commenting, staff
or member, and staff get a badge.

- The article page doesn't render comments. `src/components/Comments` loads them from
  `GET /api/comments/thread/:id` once the reader scrolls near, and posts to the same path, so
  the page stays one cached copy for everyone.
- **Replies** store `parent` and `depth`. The reply depth is in the **Comment settings** global
  (admins), checked only when a reply is posted, so lowering it never touches old threads.
  A removed comment with replies still showing comes back as a placeholder (`thread.ts`).
- **Checks** run on each post (`checks.ts`: link limit, repeated comment, plus the `checks`
  option). A failure saves the comment as `auto-hidden`, shown only to its author, and adds a
  violation. A moderator hiding a published comment adds one too; publishing a held or hidden
  one reverses it (`recordModeration`).
- **Require a verified email address** (off by default) in Comment settings limits posting
  to authors `isVerified` accepts: staff, or a provider-verified `emailVerified`.
- **Violations** (`comment-violations`) lock commenting once the settings' threshold is active
  within its window, until enough age out or are reversed (`lockFor`); a `block` locks until
  it's reversed.
- Deleting an article deletes its comments. Deleting a comment deletes its replies. Deleting a
  user empties their comments (status `deleted`, no author) so others' replies keep their place.
- `tests/integration/comments.test.ts` signs readers up with Discord stubbed, and posts.

### Integrations

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

### Test coverage

**Test types by code kind:**

| Code type                      | Test type                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Pure utility functions         | Unit test in `src/**/__tests__/`                                                           |
| Blocks and components          | Storybook story next to the component (see [Storybook](#storybook))                        |
| UI/presentational components   | Snapshot test (see `src/components/ui/__tests__/button.snapshot.test.tsx` for the pattern) |
| Client components with state   | RTL interaction test (`fireEvent`; `user-event` is not installed)                          |
| Server components (async, CMS) | Integration test with mocked Payload queries                                               |
| API routes / Payload hooks     | Integration test (a Docker Postgres, see `tests/integration/`)                             |

**DOM assertions:** `@testing-library/jest-dom`'s matchers are registered globally in
`vitest.setup.ts`. Assert with them rather than by hand — they name the element and print
its markup when they fail, where a raw property read reports only `expected null to be "x"`:

| Instead of                                  | Use                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `expect(getByRole(...)).toBeTruthy()`       | `.toBeInTheDocument()` (`getBy*` already throws when missing, so `toBeTruthy` asserts nothing) |
| `expect(queryBy...).toBeNull()`             | `.not.toBeInTheDocument()`                                                                     |
| `expect(el.getAttribute("href")).toBe(url)` | `expect(el).toHaveAttribute("href", url)`                                                      |
| `expect(el.className).toContain("grid")`    | `expect(el).toHaveClass("grid")` (matches whole class tokens, not substrings)                  |
| `expect(btn.disabled).toBe(true)`           | `expect(btn).toBeDisabled()`                                                                   |
| `expect(container.firstChild).toBeNull()`   | `expect(container).toBeEmptyDOMElement()`                                                      |

Partial attribute values go through an asymmetric matcher —
`toHaveAttribute("rel", expect.stringContaining("noopener"))`.

File-level exclusions are configured in `vitest.config.mts` `coverage.exclude` for auto-generated files (`src/migrations/**`, `src/payload-types.ts`, `src/app/(payload)/**`, `src/payload.config.ts`).

Coverage reporting is informational only — chore/docs PRs don't need special handling.

### Testing your changes

- run linting and type-checks
- run unit and integration tests as needed, _skip running e2e_.
- touched a block or component? run `pnpm test:storybook`, and add or update its story.
- does the change, or what you tell someone, depend on how Payload, Coolify, GitHub, Cloudflare or
  Sentry behaves (an option, a setting, a permission, a sampling or cache rule)? Check it with the
  **`upstream-docs`** skill or the package's source in `node_modules` first, even when the question
  comes up partway through other work. Hosted settings aren't in `node_modules`; their docs are.

### Storybook

Every block and component has a colocated `*.stories.tsx`. Each story also runs as a test
(`pnpm test:storybook`, and CI's Storybook job): it renders in Chromium, runs its `play`
function, and fails on any axe violation.

- **Fixtures** live in `src/stories/fixtures/` (docs, media, rich text, navigation). Reuse them
  rather than inlining Payload shapes. Media points at `.storybook/assets`, so no story touches
  the network.
- **Payload**: `.storybook/main.ts` swaps `@/data/payload` for
  `src/stories/mocks/payload.ts`. Seed a story in `beforeEach` with
  `mocked(getPayloadClient).mockResolvedValue(createFakePayload({ collections, globals }))`.
  Server code must reach Payload through `getPayloadClient`: a direct `getPayload({ config })`
  pulls the Payload config into the browser bundle and breaks `pnpm storybook:build`.
- **Known a11y failures**: skip only the failing rule with `skipA11yRules("rule-id")` from
  `src/stories/a11y.ts` and cite the issue tracking the fix; `knownContrastIssue` covers the
  brand colors (#998). Never turn a story's a11y test off wholesale.
- **Third-party embeds** that load a platform's script get `tags: ["!test"]`.
- **Published**: CI's "Deploy Storybook" job uploads the tested build to the
  `pragmatic-papers-storybook` Cloudflare Worker (`.storybook/wrangler.jsonc`):
  `dev` at `pragmatic-papers-storybook.digital-ground-game.workers.dev`, and each PR at a
  `pr-<number>-` preview URL, which `scripts/storybook-pr.ts` records as a "Storybook"
  GitHub Deployment (in the PR's deployments, beside the site's Preview). When the PR changes
  components, it also links each one at the top of the PR description (under the showcase links and the links line),
  matched through the build's `index.json` by story file, `component` file or folder. `/storybook` on staging and on a
  PR's site preview redirects to its Storybook (404 on production). Needs the `CLOUDFLARE_API_TOKEN`
  (Workers Scripts: Edit) and `CLOUDFLARE_ACCOUNT_ID` repo secrets; without them it skips.

### PR description links

CI keeps the top of a PR's description up to date, under any `Closes #N` lines:
the showcase links (`scripts/showcase-pr.ts`), then one line of links, then the
Storybook links (`scripts/storybook-pr.ts`). The line holds the live preview,
and the PR analytics comment ("Coverage"); each job sets its own link with `setPrLink`, and the Preview link is
left out while showcase links point at the same site. Each block sits between
`<!-- name -->` markers, and every job edits the description through
`scripts/pr-description.ts`: `withBlock` places a block, and `editPrBody`
reads the description back after writing and writes again when another job's
edit replaced it (GitHub has no conditional write). A script run under plain
Node imports it as `./pr-description.ts`, and its workflow's sparse checkout
lists it. `.github/pull_request_template.md` lists the blocks above Context,
Screenshots and Test Plan.

### Page speed

The "Page speed" job in `playwright.yml` measures the image the PR deploys two ways,
and each compares it with the last run on `dev` in a dropdown under the coverage report, in the one
PR analytics comment CI keeps on a PR. A dropdown starts open when it flags
something. A new report joins that comment by registering a section in
`PR_REPORT_SECTIONS` (`scripts/pr-report.ts`) and posting it with
`postPrReportSection()`, rather than posting a comment of its own:

- **Bundle size** (`scripts/bundle-size.ts`, the job's first part) reads the image's build manifests and
  adds up the gzipped JavaScript and CSS each public page loads before it's
  interactive (Next 16 no longer prints "First Load JS"). Pages are expected to
  grow over time, so there are no fixed budgets: a route whose JavaScript grew by
  more than 10 kB against dev is flagged in the comment and with a warning on the
  PR's checks. It **only warns**; `pnpm analyze` shows which import brought the
  growth in.
- **Lighthouse** (`scripts/lighthouse.ts`, run even when bundle size fails) runs on a PR when
  the `in review` label is added (six minutes on every push otherwise; the Claude review takes
  the label off when it finishes), and on every push to `dev`. It seeds the E2E database, starts the PR's image and audits each page 5 times, comparing with the results the last
  push to `dev` uploaded. The CPU slowdown is calibrated to the runner's benchmark
  score, and Chrome can't reach any host but localhost. Dev's results come from
  another runner, so a metric is flagged only when every PR run is worse than
  every dev run by a wide margin (`THRESHOLDS`). It **only warns**: the HTML
  reports are in the `lighthouse-results` artifact. A page added to the seed can
  be audited by adding it to `PAGES`.

### Interactive maps

Preparing a pre-projected SVG, uploading to Maps (the `map-assets` collection), or chasing a map that
renders blank, all-grey, without tooltips, or drills into nothing? Use the
**`interactive-maps`** skill (`.claude/skills/interactive-maps/SKILL.md`).

Two things live there, and they are not two modes of one block:

- The **Interactive Map block** is a **choropleth** only — regions shaded by a
  value, R+/D+ color scale, from an SVG a writer uploads to Maps. The
  skill covers the sanitizer allowlist that silently eats most exports.
- A **drilldown** is an **interactive page** (`/interactives/<slug>`, the
  `interactives` + `interactive-snapshots` collections, `src/interactives/`):
  an overview map whose regions open into their children and records, whose
  data a researcher's feed keeps updating. Pragmatic Papers owns geometry and
  presentation in code; the feed owns facts and records; `syncInteractiveData`
  pulls it daily into draft snapshots an editor publishes.

An SVG never carries records. A drilldown's SVG is checked in, parsed once at
snapshot time into `geometry/*.json`, and never parsed again;
`scripts/snapshot-federal-courts.ts` regenerates the Federal Courts geometry
and data fixture from a court-tracker checkout. The fixture is trimmed to three
courts' benches (`--keep`); `pnpm dev:db-seed` with `COURT_TRACKER_GITHUB_TOKEN`
set seeds every judge from upstream's newest release instead. Interactive pages
are the `interactives` experiment: with it off in Settings they 404, their
sitemap is empty, and the daily sync skips. Validate a file before
committing or uploading it:
`pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts <file.svg> [--mode geometry]`.

## Hosting (Coolify)

The site is hosted by Coolify in three applications: **staging** (from `dev`) and
**production** (from `main`), which Coolify builds from
`dockerfiles/PragmaticPapers.Dockerfile`, and **preview** (one per PR), which runs the
image GitHub Actions builds from `dockerfiles/PragmaticPapers.ci.Dockerfile`. Coolify doesn't report
its deploys to GitHub, so `.github/workflows/deployments.yml` records each push to `dev` and `main` as a
Staging or Production Deployment, live once the site's `/next/version` names the commit. `dockerfiles/README.md` records how _our_
applications are set up and what's been verified about them; read it first.

Staging's public site also runs as a Cloudflare Worker at `staging-worker.pragmaticpapers.com`
(OpenNext, reading staging's database through Hyperdrive), deployed on every push to `dev` by
`.github/workflows/worker.yml`; setup and what's left before production are in
`src/cloudflare/README.md`.

The zone's Cloudflare rules (Cache Rules today) are version-controlled in
`cloudflare/rulesets/` and applied on release by `.github/workflows/cloudflare-rules.yml`;
change them there, not in the dashboard (`cloudflare/README.md`).

## Releases

A release train (`.github/workflows/release-train.yml`, `scripts/release-train.ts`)
cuts a candidate after Wednesday's dev meeting and puts it live at midnight going into
Sunday, leaving a day to check production before Monday's articles. At midnight
Pacific going into Thursday it opens a "Bump package.json to vX.Y.Z" PR into `dev`
(the next **candidate**, versioned from commit prefixes: `!` major, `feat` minor,
anything else patch). Saturday at 16:00 UTC (8am PST, 9am PDT), once a merged
candidate has spent `SOAK_DAYS` (1) on staging, it opens a "Release X.Y.Z" PR into
`main` from a branch at that bump commit. At midnight Pacific going into Sunday it
merges that PR with a **merge commit** if a maintainer has approved it and its checks
are green; `release.yml` then
tags it. Unapproved, it waits for a person. Cron is UTC, so the midnight runs are at
08:00 UTC: midnight PST, 1am PDT. Only one candidate settles at a time, and the bump
lands on `dev` first, so nothing is back-merged. The exception is `pnpm hotfix`: a
candidate cut before a hotfix would conflict with `main`, so the train skips it and
cuts nothing until the hotfix is back-merged into `dev`. `pnpm release` remains for doing it by hand.

## Third-party docs

For how a tool we run on behaves (Payload and Lexical, Coolify, GitHub Actions and the
REST API, Cloudflare, Sentry) or what's in this repo's wiki, use the **`upstream-docs`**
skill (`.claude/skills/upstream-docs/SKILL.md`) instead of searching the web or answering
from memory. It clones each project's docs source into the gitignored `.cache/upstream-docs/`
(Payload's pinned to our installed version) and says where to look. It works in cloud
sessions, which can't reach most documentation sites. Next.js's docs are already in
`node_modules/next/dist/docs/`.

## Claude review gate

PRs into `dev` need the **Review acknowledged** check (`review-ack.yml`) on
their final commit. A person gives it one of two ways: approving the PR with a
GitHub review, or replying `/reviewed` or `LGTM` (any case) after a Claude
review is on the PR:
CI's (`claude-review.yml`, run by adding the "in review" label, which the
review removes when it's done, so adding it again asks for another) or one
they posted with a local `/code-review --comment <pr>` (they need write access).
Fixes pushed after a review need a new approval or reply, not a new
review. **Never post `/reviewed` or `LGTM` (or anything starting with either),
and never submit an approving review** — not even when asked to get a PR mergeable. Both
record that a person read the change; say it's waiting on them instead.

## Filing & triaging GitHub issues

Creating, editing, triaging, labeling, or picking up an issue — or
adding/removing a label, or setting its board fields? Use the **`github-issues`** skill
(`.claude/skills/github-issues/SKILL.md`). It covers applying an issue
**type** (`Bug`/`Feature`/`Task`) as well as **labels** (`Bug` is a type, not
a label), and the label taxonomy is version-controlled in
`.github/labels.yml` — edit that file in a PR to change a label; a sync
workflow applies it on push to `dev`. It also covers the **Project board
fields** (`Priority`, `Size`, `Estimate`, `Status`) on the "Pragmatic Papers
Development" board, set with
`pnpm tsx .claude/skills/github-issues/set-project-field.ts <issue> <field> <value>`
(needs the `project` token scope).

## Wiki

The repo wiki lives at `https://github.com/digitalgroundgame/pragmatic-papers/wiki` and is a separate git repository. To create or edit wiki pages:

```bash
git clone https://github.com/digitalgroundgame/pragmatic-papers.wiki.git /tmp/wiki
# create or edit .md files in /tmp/wiki
cd /tmp/wiki
git add <file>
git commit -m "docs: ..."
git push
```

> [!NOTE]
> Commit signing does not work in the wiki repo from the **remote/cloud execution environment** — the signing server is scoped to the main repo. If running in that context and a push fails due to signing, ask the user to re-run the session locally (e.g. in Cursor or another terminal where their git signing is configured), then retry the push.

After adding a new page, update `Home.md` to add it to the Table of Contents under the appropriate section, and match the back-link style used by other pages:

```md
[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
