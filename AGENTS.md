# AGENTS.md

This file provides guidance to tools like Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pragmatic Papers** is a Next.js 16 website with Payload CMS 3 as the headless CMS. PostgreSQL database via Docker, Drizzle ORM (managed by Payload).

## Commands

### Development

- `pnpm dev` — starts everything in Docker Compose (Postgres + Next.js dev server on port 8000)
- `pnpm dev:db-nuke` — stop Postgres and delete its volume (`docker compose down -v`), wiping the entire data directory. Use this after a Postgres major-version bump or whenever the local data is corrupt; the next `pnpm dev` recreates a fresh cluster and Drizzle push re-syncs the schema
- `pnpm dev:db-fresh` — bring Postgres up and rebuild the schema by re-running all migrations from scratch (`payload migrate:fresh`). Unlike `dev:db-nuke`, this keeps the volume and exercises the committed migration files (the same path prod uses), so it surfaces migration drift that Drizzle push masks in dev
- `pnpm dev:db-seed` — bring Postgres up, seed it from the terminal, and stop it again. Runs the same `seed()` as the admin dashboard's "Seed your database" button, so it first deletes **every** article, volume, page, media file, topic, map asset, interactive, form and form submission (not just seeded ones), the seed users, and the recommendation rankings, then loads the help docs in `src/docs/`, published. Drizzle push builds the schema on an empty database, so it works straight after `dev:db-nuke`. It refuses to run unless `DATABASE_URI` points at localhost and `USE_LOCAL_STORAGE=true` (override with `SEED_ALLOW_REMOTE=true`), and exits 1 if you decline Drizzle's data-loss prompt. Stop `pnpm dev` first: this command stops the Postgres container it shares.
- `pnpm showcase <pr-number | staging | url> (<slug...> | --all) [--draft]` — push feature articles from the catalog in `src/endpoints/seed/showcase.ts` to a live site through its REST API, as `SHOWCASE_EMAIL` / `SHOWCASE_PASSWORD` (an account with an author role). A PR number means its `pr-<n>.pragmaticpapers.com` preview; `staging` means `SHOWCASE_STAGING_URL`, and pushes drafts. Only adds articles whose slug is missing (for one that's there, an entry's `ensure` recreates what it links to if that's gone); deletes nothing. A PR with the `showcase` label or a `Showcase: <slug...>` line in its description (the workflow keeps the two in sync; the label alone inserts a line naming the articles the PR adds to the catalog) gets them pushed to its preview after every deploy by `.github/workflows/showcase.yml`, which then turns that line into links to them, titled, at the top of the description, and can also be run by hand for a PR (the articles join that line, which opts the PR in) or staging. Nothing is pushed by default: when a PR adds a seeded article to that catalog, opt it in by adding the `showcase` label or putting `Showcase: <slug>` in its description

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
- `pnpm test:unit-snapshot` — regenerate snapshot baselines after intentional UI changes (`pnpm test:unit -u`). It accepts every changed snapshot as the new baseline and stays in watch mode, so review the `.snap` diff before committing
- `pnpm coverage:report` — post the coverage section of CI's PR comment locally (requires `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_EVENT_PATH`)
- `pnpm bundle-size` — measure the gzipped client JS and CSS each public page loads, from the build in `.next` (run `pnpm build` first), and compare it with dev's last measurement when `BASE_BUNDLE_SIZE_PATH` names one (see [Page speed](#page-speed))
- `pnpm analyze` — Turbopack's bundle analyzer, in the browser (it compiles but doesn't leave a build behind): each route's client and server modules, and the import chain that brings each one in. `pnpm analyze --output` writes it to `.next/diagnostics/analyze/` instead, which the next `pnpm build` deletes
- `pnpm lighthouse` — seed a throwaway database, build and serve as `pnpm test:e2e` does, then run Lighthouse's performance audit on a few seeded pages; reports land in `lighthouse-results/`. Set `BASE_LIGHTHOUSE_PATH` to a `summary.json` from an earlier run to compare with it (see [Page speed](#page-speed))

### Test databases

In `tests/AGENTS.md`, which loads when you work under `tests/`.

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

- **`fields/`** — New fields should include `Field` in the name (e.g. `buttonField`, `menuField`).
- **`data/`** — server reads shared across pages: `getPayloadClient` (`payload.ts`), `getGlobal` (`globals.ts`), the `query*BySlug` helpers (`queries.ts`)
- **`hooks/`** — shared React hooks (`useInView`, `useDebounce`, shadcn's `use-mobile`) and the Payload hooks several collections share (`purgeEdgeCache`, `revalidate*`)

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

1. Add an `experimentField` to the `experiments` group, `defaultValue: false`, with
   `beta: { info }` if readers will see it (a flask beside its heading says so, `BetaBadge`),
   then run `pnpm payload generate:types` and `pnpm migrate:create`.
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

In `src/plugins/docs/AGENTS.md`, which loads when you work under `src/plugins/docs/`. Read it before writing or editing a doc in `src/docs/`.

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

- **seoPlugin** — `generateTitle`, `generateDescription` and `generateURL` for the SEO tab each collection builds itself. A collection must also be listed in the plugin's `collections`, or its Auto-generate buttons get a 403

### Our plugins

In `src/plugins/AGENTS.md`, which loads when you work under `src/plugins/`.

### Collection Conventions

- **File structure**: `collections/<Name>/index.ts` with optional `hooks/` and `components/` subdirectories
- **Hook naming**: `revalidate*` for cache invalidation, `generate*`/`populate*` for data transformation, `pushTo*`/`check*` for side effects
- **Admin sidebar**: every collection and global sets `admin.group` to one of Content, Site, Interactives, Store, System or Help, and labels are a single word where one reads clearly (`labels`/`label`, never the slug). Groups appear in the order of their first entry in `payload.config.ts`
- **Tabs pattern**: Content + SEO tabs; SEO tab uses standard fields (`OverviewField`, `MetaTitleField`, `MetaImageField`, `MetaDescriptionField`, `PreviewField`)
- **Versions config**: `drafts.autosave: true`, `schedulePublish: true`, `maxPerDoc: 50`
- **Live preview**: `generatePreviewPath()` for `admin.livePreview.url` and `admin.preview`
- **Breadcrumbs**: a page builds its trail (`Crumb[]`, the steps after Home) from the documents it loaded and passes the same list to `<Breadcrumbs items={...} />` and `buildBreadcrumbJsonLd`. Labels are titles, never derived from slugs, and nothing reads the request. A nested collection (the nested-docs plugin) builds it with `nestedDocsTrail(doc.breadcrumbs, basePath)` from `@/components/Breadcrumbs`
- **Media references**: media used by published content can't be deleted until it's detached (the Media **References** tab). An upload field, or a rich text or `blocks` field whose blocks hold media, must be listed in `SOURCES` (`src/collections/Media/references/collectMediaReferences.ts`), and a block that holds media declares where in its descriptor's `media` (see [Block Conventions](#block-conventions)), or media it uses can be deleted without warning

### Block Conventions

In `src/blocks/AGENTS.md`, which loads when you work under `src/blocks/`.

### Data Fetching Patterns

- Code with a request (hooks, endpoints, access functions, validation, jobs) reads Payload from `req.payload`, inside the request's transaction. Code without one (pages, layouts, route handlers, `generateMetadata`) uses `getPayloadClient` from `@/data/payload`, never `getPayload({ config })`
- Wrap data queries in `React.cache()` for per-request deduplication
- Use `unstable_cache` with cache tags for long-lived caching (globals, redirects, sitemaps)
- Sitemaps: each is a `sitemap.ts` in the folder of the section it lists (Next's metadata convention, served at `/<route>/sitemap.xml`, e.g. `docs/sitemap.ts`), added with a title to `SITEMAPS` in `src/data/feeds.ts`, which `/sitemap_index.xml`, robots.txt and the Feed list block read (that block, `blocks/FeedsList`, lists them and the RSS feeds in `FEEDS` from the same file on the `/feeds` page, a Pages document editors own: a deploy creates it once per site as a draft for an editor to publish, then never touches it again, even once deleted (`STARTER_PAGES` in `collections/Pages/starterPages/`), and the seed creates it published locally). Pages live at the root, so theirs is the root `sitemap.ts` (`/sitemap.xml`), and the index of them all is `/sitemap_index.xml` (`(sitemaps)/sitemap_index.xml`), which robots.txt and Search Console point at; Google News reads `articles/news-sitemap.xml/route.ts`, a route handler (`sitemap.ts` can't write `news:` tags) listing only the last two days' articles, as Google asks. The old `/pages-sitemap.xml`, `/articles-sitemap.xml` and `/volumes-sitemap.xml` redirect permanently in `next.config.ts`
- Always respect `draftMode()` — pass `draft` and `overrideAccess: draft` into Payload queries
- Next.js 16: `params` and `searchParams` are `Promise`s (must be `await`ed)
- Metadata: use `generateMeta({ doc, canonicalPath })` from `@/utilities/generateMeta`
- Static generation: implement `generateStaticParams()` with `overrideAccess: false` and `draft: false`

### Key Patterns

- **Database in dev**: Drizzle "push" mode auto-syncs schema changes — no manual migrations needed during development
- **Styling**: TailwindCSS with CSS variables for theming
- **Content rendering**: Blocks system with Lexical rich text editor; each block has a config and a React component
- **Pre-push hooks**: Husky runs full checks on all files (`lint:fix`, `format:fix`, `check-types`) before pushing
- **Pre-commit hooks**: lint-staged runs ESLint + Prettier on staged files only (fast, ~1-2 seconds)
- **Menus and toggles load on first use**: the header's sheets, mega menu and mode toggles are on every page, and most readers never open them. Their `*.lazy.tsx` wrappers render through `LoadOnInteraction` (`src/components/LoadOnInteraction`): markup that looks the same (the trigger button, or the menu's links) until the reader points at, touches, focuses or clicks it, then the base-ui component, with the click replayed and focus kept. Keep the layouts' server components from importing anything that imports base-ui's dialogs or menus (`ui/sheet`, `ui/dropdown-menu`, `ui/navigation-menu`): its client code would be back in every page's first-load JavaScript. `pnpm bundle-size` shows it
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

In `src/plugins/sso/AGENTS.md`, which loads when you work under `src/plugins/sso/`.

### Comments

In `src/plugins/comments/AGENTS.md`, which loads when you work under `src/plugins/comments/`.

### Achievements

In `src/plugins/achievements/AGENTS.md`, which loads when you work under `src/plugins/achievements/`.

### Integrations

In `src/integrations/AGENTS.md`, which loads when you work under `src/integrations/`.

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
- **Design guide**: `src/design/` holds Storybook's "Design guide" pages (MDX): the site's
  tokens, type, spacing, layout and components as they are, and an audit of where each public
  page departs from the common layout (`pageLayouts.ts`). Its tests fail when globals.css gains
  a token the guide doesn't list, or a page's wrapper changes without its audit entry: when you
  fix a page's layout, update its entry in the same PR.
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

In `scripts/AGENTS.md`, which loads when you work under `scripts/`.

### Page speed

In `scripts/AGENTS.md`, which loads when you work under `scripts/`.

### Interactive maps

Preparing a pre-projected SVG, uploading to Maps (the `map-assets` collection), or chasing a map that
renders blank, all-grey, without tooltips, or drills into nothing? Use the
**`interactive-maps`** skill (`.claude/skills/interactive-maps/SKILL.md`).

The Interactive Map block (a choropleth), drilldown interactive pages and whip counts are covered in `src/interactives/AGENTS.md`, which loads when you work under `src/interactives/`.

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
`.github/workflows/worker.yml`; PRs that could break its build get it built and served by
`.github/workflows/worker-build.yml`, which deploys nothing. Setup and what's left before
production are in `src/cloudflare/README.md`.

Each database has one seeder: the deploy of the Coolify app that runs its migrations. Its
`/next/revalidate-all` seeds what a deploy seeds (starter pages, starter achievements); the Worker reads
the same database and sets `DEPLOY_SEED=false` (`wrangler.jsonc`), so its deploy only throws
pages away. Two seeders could each create the same content at once. Deploy-seeded content
added later goes through that route, so it follows the same switch.

The zone's Cloudflare rules (Cache Rules, and the Single Redirect from www to the apex) are version-controlled in
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

## Sentry errors and bugs to draft PRs

`.github/workflows/sentry-intake.yml` runs hourly: it files a GitHub issue (label `sentry`)
for each unresolved Sentry error matching `SENTRY_QUERY` (by default seen 3+ times in
production or staging and still happening, so one-off blips stay out) that no issue names yet,
open or closed, and that `.github/sentry-filter.json` doesn't keep out (levels, an optional
filter to errors with a frame in our code, and include/exclude patterns on title, culprit,
exception type, message, URL or transaction, seeded with known noise). The issue starts with the `Sentry Issue: [SHORT-ID](link)` line Sentry's own
integration writes, which is how either finds the other. `.github/workflows/sentry-fix.yml`
then has Claude triage it as fix, noise, duplicate or needs-info, say so in a comment and
retitle the issue; for a fix it opens a draft PR into dev (branch `claude/sentry-<issue>`,
pushed with the release App's token so its checks run), assigned to `SENTRY_FIX_REVIEWER`.
Claude runs with a read-only token and its commits leave the job as a patch, since the
error text it reads comes from production traffic; the commands it runs don't inherit
`CLAUDE_CODE_OAUTH_TOKEN` or `NODE_AUTH_TOKEN` (`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`, which runs them in Claude Code's Bash sandbox, so the job installs bubblewrap and socat first), and a patch
that changes anything outside `src/` and `tests/` isn't pushed, since PR checks run `scripts/`,
`.storybook/` and the workflows from the branch with secrets; nor is one that changes an
`AGENTS.md` or `CLAUDE.md`, the instructions later agent runs load. At most `SENTRY_FIX_DAILY_LIMIT` (3) runs
start in 24 hours; the rest, including issues filed beyond the day's room, wait labeled
`claude queued`. Intake reads Sentry a page at a time (up to 8) past errors already filed or
kept out, so recurring ones don't crowd out new ones. Adding the `fix with claude` label
to any issue starts a run now, past the budget; `SENTRY_FIX_AUTO=false` makes that the only
way. The rules are in `scripts/sentry-fix.ts`.

The same intake queues the team's own bugs (`eligibleIssue`): open issues of type Bug
(`ISSUE_FIX_TYPES`, comma-separated), written by someone with access to the repository
(anyone can file an issue on a public repo, and its text is Claude's instructions), with no
assignee, none of `HOLD_LABELS` (blocked, discussion, question, waiting on design, security,
wontfix and the like), and no earlier Claude attempt. They share the daily budget and the
safeguards above. Assigning someone keeps Claude off an issue; `ISSUE_FIX_AUTO=false`
leaves only Sentry issues and labeled ones.

## Claude review gate

PRs into `dev` need the **Review acknowledged** check (`review-ack.yml`) on
their final commit. A person gives it one of two ways: approving the PR with a
GitHub review, or replying `/reviewed` or `LGTM` (any case) after a Claude
review is on the PR:
CI's (`claude-review.yml`, which runs when a draft is marked ready for review
and whenever the "in review" label is added, then removes the label, so adding
it again asks for another; or a comment mentioning `@claude` asking for a review,
`claude.yml`) or one they posted with a local `/code-review --comment <pr>` (they
need write access).
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

Creating or editing a page in the repo wiki? Use the **`wiki`** skill (`.claude/skills/wiki/SKILL.md`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
