# AGENTS.md

This file provides guidance to tools like Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pragmatic Papers** is a Next.js 15 website with Payload CMS 3 as the headless CMS. PostgreSQL database via Docker, Drizzle ORM (managed by Payload).

## Commands

### Development

- `pnpm dev` — starts everything in Docker Compose (Postgres + Next.js dev server on port 8000)
- `pnpm dev:db-nuke` — stop Postgres and delete volume data

### Quality Checks

- `pnpm lint` — ESLint across the project
- `pnpm lint:ci` — lint with `--max-warnings 0` (used in CI)
- `pnpm lint:fix` — auto-fix lint issues
- `pnpm format` / `pnpm format:fix` — Prettier check/fix
- `pnpm check-types` — TypeScript type checking

### Testing

- `pnpm test` — run all tests (Vitest)
- `pnpm test:unit` — run unit tests
- `pnpm test:integration` — run integration tests (uses Testcontainers)
- `pnpm test:e2e` — run Playwright E2E tests (uses Testcontainers)

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
- **`access/`** — Access control hooks (authenticatedOrPublished, editorOrSelf, writer)
- **`app/(frontend)/`** — Public-facing Next.js pages using App Router
- **`app/(payload)/`** — Payload admin panel routes
- **`components/`** — Reusable React components for layouts, pagination, etc; `components/ui/` uses shadcn/ui;
- **`providers/`** — Context providers (MathJaxProvider)
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
- Fetched via `getCachedGlobal('header' | 'footer', depth)()` using `unstable_cache` with tags

### Payload Plugins

- **redirectsPlugin** — redirects on pages, volumes, articles (admin currently hidden)
- **nestedDocsPlugin** — nested docs on categories (breadcrumb URLs)
- **seoPlugin** — SEO fields with custom `generateTitle` and `generateURL`
- **formBuilderPlugin** — form builder (admin currently hidden)
- **s3Storage** — S3/Supabase media storage; falls back to local when `USE_LOCAL_STORAGE=true`

### Collection Conventions

- **File structure**: `collections/<Name>/index.ts` with optional `hooks/` and `components/` subdirectories
- **Hook naming**: `revalidate*` for cache invalidation, `generate*`/`populate*` for data transformation, `pushTo*`/`check*` for side effects
- **Tabs pattern**: Content + SEO tabs; SEO tab uses standard fields (`OverviewField`, `MetaTitleField`, `MetaImageField`, `MetaDescriptionField`, `PreviewField`)
- **Versions config**: `drafts.autosave: true`, `schedulePublish: true`, `maxPerDoc: 50`
- **Live preview**: `generatePreviewPath()` for `admin.livePreview.url` and `admin.preview`

### Block Conventions

- **File structure**: `blocks/<Name>/config.ts` (Payload config) + `blocks/<Name>/Component.tsx` (React component)
- **Two rendering systems**: `RenderBlocks` renders page layout blocks (Content, CTA, MediaBlock, Form, VolumeView); `RichText` renders Lexical inline/rich-text blocks (Banner, Code, Math, Footnote, SocialEmbed, SquiggleRule)

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

### Testing your changes

- run linting and type-checks
- run unit and integration tests as needed, _skip running e2e_.
