# AGENTS.md

This file provides guidance to tools like Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pragmatic Papers** is a Next.js 15 website with Payload CMS 3 as the headless CMS. PostgreSQL database via Docker, Drizzle ORM (managed by Payload).

## Commands

### Development

- `pnpm dev` — starts everything in Docker Compose (Postgres + Next.js dev server on port 8000)
- `pnpm dev:db-nuke` — stop Postgres and delete its volume (`docker compose down -v`), wiping the entire data directory. Use this after a Postgres major-version bump or whenever the local data is corrupt; the next `pnpm dev` recreates a fresh cluster and Drizzle push re-syncs the schema
- `pnpm dev:db-fresh` — bring Postgres up and rebuild the schema by re-running all migrations from scratch (`payload migrate:fresh`). Unlike `dev:db-nuke`, this keeps the volume and exercises the committed migration files (the same path prod uses), so it surfaces migration drift that Drizzle push masks in dev
- `pnpm dev:db-seed` — bring Postgres up, seed it from the terminal, and stop it again. Runs the same `seed()` as the admin dashboard's "Seed your database" button, so it first deletes **every** article, volume, page, media file, topic, map asset, interactive, form and form submission (not just seeded ones), the seed users, and the recommendation rankings. Drizzle push builds the schema on an empty database, so it works straight after `dev:db-nuke`. It refuses to run unless `DATABASE_URI` points at localhost and `USE_LOCAL_STORAGE=true` (override with `SEED_ALLOW_REMOTE=true`), and exits 1 if you decline Drizzle's data-loss prompt. Stop `pnpm dev` first: this command stops the Postgres container it shares.
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
- `pnpm test:e2e` — run Playwright E2E tests against a throwaway Postgres in Docker (see [Test databases](#test-databases)). Screenshot comparisons are skipped unless `CI` is set; generate visual baselines with `pnpm test:e2e:update-snapshots` (Dockerized; matches CI pixel-for-pixel on x86_64 hosts — see `tests/e2e/README.md` for the full lifecycle) and commit them with the PR — never generate/commit baselines from a bare local machine
- `pnpm test:unit:coverage` — run unit tests with V8 coverage report (what CI uses; outputs `coverage/coverage-summary.json` and `coverage/coverage-final.json`)
- `pnpm test:coverage` — run all tests with V8 coverage report (full picture for local inspection)
- `pnpm test:unit -u` — regenerate snapshot baselines after intentional UI changes
- `pnpm coverage:report` — post the combined coverage PR comment locally (requires `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_EVENT_PATH`)
- `pnpm bundle-size` — measure the gzipped client JS and CSS each public page loads, from the build in `.next` (run `pnpm build` first), and check JS against `bundle-budgets.json`; `--update` rewrites the budgets as each route's size plus 10 kB (see [Page speed](#page-speed))
- `pnpm lighthouse` — seed a throwaway database, build and serve as `pnpm test:e2e` does, then run Lighthouse's performance audit on a few seeded pages; reports land in `lighthouse-results/`. Set `BASE_SERVER_URL` to compare with a second server (see [Page speed](#page-speed))

### Test databases

`pnpm test:integration`, `pnpm test:e2e` and `node scripts/check-pending-migrations.mjs`
get their database from `startTestDatabase()` in `scripts/test-db.mjs`. They never read
`DATABASE_URI` (that's your dev database in `.env`); they only set it for the Payload
processes they start.

- By default it `docker run`s `postgres:17-alpine` on a random localhost port and removes
  it on exit, Ctrl-C or SIGTERM. A container left by a `kill -9` is swept by the next run.
- Integration and E2E start from a **pre-migrated snapshot image**
  (`pragmatic-papers-test-db:<hash>`, keyed on `src/migrations/**` and the Postgres image),
  so they skip `payload migrate` until a migration changes; a miss migrates once and commits
  a new one. The pending-migrations check always replays from scratch, and CI (`CI` set)
  never uses a snapshot. `docker image rm` the tags to force a fresh migrate.
- `TEST_DATABASE_URI` points them at an existing database instead (CI's E2E jobs, and
  `pnpm test:e2e:update-snapshots`, whose containers can't start their own). It is refused if
  it names the same database as `DATABASE_URI` in `.env`.

### Build & Payload

- `pnpm build` — build the application
- `pnpm payload generate:types` — regenerate Payload TypeScript types
- `pnpm payload generate:importmap` — regenerate Payload import map
- `pnpm payload migrate` — run database migrations
- `pnpm payload migrate:create "migration_name"` — create a new migration. Pass a name as the first argument.

## Architecture

### Project Structure (`src/`)

- **`payload.config.ts`** — Central Payload CMS configuration
- **`collections/`** — Payload collections: Articles, Pages, Users, Volumes, Media, Categories, Webhooks
- **`blocks/`** — Content blocks used in Lexical rich text: Banner, Code, Content, Footnote, Math, MediaBlock, SocialEmbed, etc.
- **`fields/`** — Custom Payload fields: colorPicker, menu, numberSlug, link, linkGroup, footnotes, button, defaultLexical. New fields should include `Field` in the name (e.g. `buttonField`, `linkGroupField`).
- **`access/`** — Access control: `roles.ts` (e.g., `admin`, `editor`, `writer`) and `policies.ts` (e.g., `isSelfOrAdmin`, `isCreatedByOrEditor`, `isPublishedOrStaff`, `isDraftOrEditor`)
- **`app/(frontend)/`** — Public-facing Next.js pages using App Router
- **`app/(payload)/`** — Payload admin panel routes
- **`components/`** — Reusable React components for layouts, pagination, etc; `components/ui/` uses shadcn/ui;
- **`providers/`** — Context providers (MathJaxProvider)
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

- **Header** (`slug: 'header'`) — nav items, action button; revalidated via `revalidateHeader` hook
- **Footer** (`slug: 'footer'`) — nav items; revalidated via `revalidateFooter` hook
- **Site Settings** (`slug: 'site-settings'`) — admin-only; its `experiments` group switches beta features on per environment; revalidated via `revalidateSiteSettings` hook
- Fetched via `getCachedGlobal('header' | 'footer', depth)()` using `unstable_cache` with tags

### Experiments

A beta feature that should run on staging before production goes behind a
checkbox in the Site Settings global's `experiments` group
(`src/globals/SiteSettings/config.ts`). Each environment has its own database,
so each has its own switches; PR previews start with staging's. To add one:

1. Add a `checkbox` to the `experiments` group, `defaultValue: false`, then
   run `pnpm payload generate:types` and `pnpm payload migrate:create`.
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

### Edge cache (Cloudflare)

Public pages are cached at Cloudflare's edge (`s-maxage=600`,
`stale-while-revalidate=86400`, from `next.config.ts`). A `revalidate*` hook
that changes what anonymous readers see calls
`purgeEdgeCache(payload.logger, "<reason>")` (`src/hooks/purgeEdgeCache.ts`)
after its own `revalidatePath` / `revalidateTag`, and only when
`context.disableRevalidate` is unset. It purges this deployment's hostname
(production, staging and previews share a zone), batches a burst of saves into
one request, returns at once, and logs and skips when the `cloudflareCache`
connection isn't configured. A new hook for content readers see should call it
too.

### Payload Plugins

- **redirectsPlugin** — redirects on pages, volumes, articles (admin currently hidden)
- **nestedDocsPlugin** — nested docs on categories (breadcrumb URLs)
- **seoPlugin** — `generateTitle`, `generateDescription` and `generateURL` for the SEO tab each collection builds itself. A collection must also be listed in the plugin's `collections`, or its Auto-generate buttons get a 403
- **formBuilderPlugin** — form builder (admin currently hidden)
- **s3Storage** — S3/Supabase media storage; falls back to local when `USE_LOCAL_STORAGE=true`

### Collection Conventions

- **File structure**: `collections/<Name>/index.ts` with optional `hooks/` and `components/` subdirectories
- **Hook naming**: `revalidate*` for cache invalidation, `generate*`/`populate*` for data transformation, `pushTo*`/`check*` for side effects
- **Tabs pattern**: Content + SEO tabs; SEO tab uses standard fields (`OverviewField`, `MetaTitleField`, `MetaImageField`, `MetaDescriptionField`, `PreviewField`)
- **Versions config**: `drafts.autosave: true`, `schedulePublish: true`, `maxPerDoc: 50`
- **Live preview**: `generatePreviewPath()` for `admin.livePreview.url` and `admin.preview`
- **Media references**: media used by published content can't be deleted until it's detached (the Media **References** tab). An upload field or a block that holds media must be listed in `SOURCES` (`src/collections/Media/references/collectMediaReferences.ts`), or media it uses can be deleted without warning

### Block Conventions

- **File structure**: `blocks/<Name>/config.ts` (Payload config) + `blocks/<Name>/Component.tsx` (React component)
- **Two rendering systems**: `RenderBlocks` renders page layout blocks (Content, CTA, MediaBlock, Form, VolumeView); `RichText` renders Lexical inline/rich-text blocks (Banner, Code, Math, Footnote, SocialEmbed, SquiggleRule)
- **Feed converters**: the RSS feeds (`/feed.articles`, `/feed.volumes`) and the Substack import feed render article content and volume editor's notes to HTML. A block's non-React renderings live in **`blocks/<Name>/converters.ts`**, one function per output **format**, named for the format rather than the feed (`timelineToHTML`, `displayMathToCode`). Each takes the block's fields plus a `FeedContext` (`src/utilities/feedHTML.ts`: `siteUrl`, `pageUrl`, `richTextToHTML` for nested rich text) and returns plain semantic HTML: absolute URLs, no inline styles, and every CMS value through `escapeHTML`. Shared logic used by several formats, or by `Component.tsx`, goes in the same file (`formatTimelineDate`). `converters.ts` must run in the browser, because Storybook imports it, so no server-only imports. The feed files only map block slugs to the format they want, through `fromBlock`: `createHtmlConverters` (`src/utilities/generateRssFeed.ts`) and, for article content, `createSubstackConverters` (`src/app/(frontend)/articles/_substack/generateSubstackFeed.ts`). A block added to those editors (or to the rich text inside their blocks) needs a converter, plus:
  - a `__tests__/converters.test.ts` using `toMatchInlineSnapshot()`, fed from `src/stories/fixtures/blocks.ts`
  - a `Feed` story that renders the output through `src/stories/FeedHTML.tsx`, so it gets the axe check

  `src/utilities/__tests__/generateRssFeed.converters.test.ts` reads the resolved Payload config and fails, naming what's missing, until every feed has a converter

### Data Fetching Patterns

- Use `getPayloadConfig` imported from `@/utilities/getPayloadConfig`
- Wrap data queries in `React.cache()` for per-request deduplication
- Use `unstable_cache` with cache tags for long-lived caching (globals, redirects, sitemaps)
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
- **Colocation**: Prefer colocating logic near where it's used. `src/utilities/` is only for genuinely reusable helpers shared across multiple features (e.g. `generateMeta`, `getURL`, `toRoman`, `cn`). Don't put single-use logic there.
- **Issue and PR numbers in comments**: comments and docs describe the code as it is now; why and when it changed is what `git log` and `git blame` are for. Don't write "added in #970", "before #672" or "see #883" — the sentence should stand on its own. Two exceptions, each a pointer with an exit: an upstream bug a workaround depends on (full URL; remove the workaround when it's fixed), and an **open** issue tracking a known gap or a skipped check (say what to remove when it closes, as `knownContrastIssue` does for #998). When that issue closes, delete the comment and what it guards; never append to it.

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

### Storybook

Every block and component has a colocated `*.stories.tsx`. Each story also runs as a test
(`pnpm test:storybook`, and CI's Storybook job): it renders in Chromium, runs its `play`
function, and fails on any axe violation.

- **Fixtures** live in `src/stories/fixtures/` (docs, media, rich text, navigation). Reuse them
  rather than inlining Payload shapes. Media points at `.storybook/assets`, so no story touches
  the network.
- **Payload**: `.storybook/main.ts` swaps `@/utilities/getPayloadConfig` for
  `src/stories/mocks/getPayloadConfig.ts`. Seed a story in `beforeEach` with
  `mocked(getPayloadConfig).mockResolvedValue(createFakePayload({ collections, globals }))`.
  Server code must reach Payload through `getPayloadConfig`: a direct `getPayload({ config })`
  pulls the Payload config into the browser bundle and breaks `pnpm storybook:build`.
- **Known a11y failures**: skip only the failing rule with `skipA11yRules("rule-id")` from
  `src/stories/a11y.ts` and cite the issue tracking the fix; `knownContrastIssue` covers the
  brand colors (#998). Never turn a story's a11y test off wholesale.
- **Third-party embeds** that load a platform's script get `tags: ["!test"]`.
- **Published**: CI's "Deploy Storybook" job uploads the tested build to the
  `pragmatic-papers-storybook` Cloudflare Worker (`.storybook/wrangler.jsonc`):
  `dev` at `pragmatic-papers-storybook.digital-ground-game.workers.dev`, and each PR at a
  `pr-<number>-` preview URL, which `scripts/storybook-pr.ts` records as a "Storybook Preview"
  GitHub Deployment (in the PR's deployments, beside the site's Preview). When the PR changes
  components, it also links each one at the top of the PR description (under any showcase links),
  matched through the build's `index.json` by story file, `component` file or folder. `/storybook` on staging and on a
  PR's site preview redirects to its Storybook (404 on production). Needs the `CLOUDFLARE_API_TOKEN`
  (Workers Scripts: Edit) and `CLOUDFLARE_ACCOUNT_ID` repo secrets; without them it skips.

### Page speed

Two jobs in `playwright.yml` measure the image the PR deploys, and each posts a
PR comment comparing it with the last run on `dev`:

- **Bundle size** (`scripts/bundle-size.ts`) reads the image's build manifests and
  adds up the gzipped JavaScript and CSS each public page loads before it's
  interactive (Next 16 no longer prints "First Load JS"). It **fails** when a
  route's JavaScript is over its budget in `bundle-budgets.json`. If the growth is
  intended, raise that route's budget in the same PR. The comment prints the new
  values, and the change shows up in the diff for review.
- **Lighthouse** (`scripts/lighthouse.ts`) seeds the E2E database and starts the
  PR's image beside dev's (the `dev` tag in GHCR, pushed by every push to `dev`).
  Dev's image gets its own copy of the database. Each page is audited 5 times on
  each image, alternating, on the same runner. The CPU slowdown is calibrated to
  the runner's benchmark score, and Chrome can't reach any host but localhost. A
  metric is flagged only when every PR run is worse than every dev run. It **only
  warns**: the HTML reports are in the `lighthouse-results` artifact. A page added
  to the seed can be audited by adding it to `PAGES`.

### Visual regression (screenshot) tests

Adding, changing, or debugging a Playwright `toHaveScreenshot` test or a flaky
visual diff? Use the **`e2e-visual-tests`** skill
(`.claude/skills/e2e-visual-tests/SKILL.md`) for the checklist; full lifecycle
in `tests/e2e/README.md`.

### Interactive maps

Preparing a pre-projected SVG, uploading a Map Asset, or chasing a map that
renders blank, all-grey, without tooltips, or drills into nothing? Use the
**`interactive-maps`** skill (`.claude/skills/interactive-maps/SKILL.md`).

Two things live there, and they are not two modes of one block:

- The **Interactive Map block** is a **choropleth** only — regions shaded by a
  value, R+/D+ color scale, from an SVG a writer uploads to Map Assets. The
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
are the `interactives` experiment: with it off in Site Settings they 404, their
sitemap is empty, and the daily sync skips. Validate a file before
committing or uploading it:
`pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts <file.svg> [--mode geometry]`.

## Hosting (Coolify)

The site is hosted by Coolify in three applications: **staging** (from `dev`) and
**production** (from `main`), which Coolify builds from
`dockerfiles/PragmaticPapers.Dockerfile`, and **preview** (one per PR), which runs the
image GitHub Actions builds from `dockerfiles/PragmaticPapers.ci.Dockerfile`. `dockerfiles/README.md` records how _our_
applications are set up and what's been verified about them; read it first.

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
CI's (`claude-review.yml`, run by adding the "ready for review" label) or one
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
