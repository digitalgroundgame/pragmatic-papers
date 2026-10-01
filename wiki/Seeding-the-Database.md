[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

Seed scripts populate the database with sample content for development.

## How to Seed

1. Navigate to `http://localhost:8000/admin`
2. Click `Seed your database`
3. Wait for all steps of seeding to complete.
4. You now have a fully populated Local Development Postgres Database.

> [!TIP]
> You can re-seed the database by simply refreshing the page. The first step of seeding is always to clean up everything it may have previously created.

### From the terminal

```bash
pnpm dev:db-seed
```

This runs the same seed as the button, with no browser or admin login. It starts Postgres, seeds it, and stops it again.

- **Stop `pnpm dev` first.** The command stops the Postgres container that `pnpm dev` also uses.
- **Works on an empty database.** Drizzle push creates the schema first, so you can run it straight after `pnpm dev:db-nuke`.
- **It wipes your local content.** Like the button, it first deletes every article, volume, page, media file, topic, map asset, form and form submission in the database (not just seeded ones), plus the seed users and recommendation rankings. Re-running it gives you a fresh seed.
- **Local only.** It refuses to run unless `DATABASE_URI` points at localhost and `USE_LOCAL_STORAGE=true`. Set `SEED_ALLOW_REMOTE=true` to override it if you really mean to.
- **Declined the schema prompt?** If Drizzle asks to accept data loss and you say no, nothing is seeded and the command exits with code 1.
- **Stale header or footer?** If the nav still shows old links when you next run `pnpm dev`, delete `.next/dev/cache` and restart ([#971](https://github.com/digitalgroundgame/pragmatic-papers/issues/971)).

## Creating Seeds

Most Issues and Pull Requests wont require seed articles. A general rule of thumb is: If your issue is a feature, and it requires migrations, then the project would likely benefit from having said feature documented.

Seed creation is a great use case for AI Agents. Simply ask the agent to create a seeding article for your new feature. Review the results to ensure the feature demonstration article meets your requirements. When your Pull Request is reviewed, reviewers can use your seed article to test the behavior of your new feature.

> [!IMPORTANT]
> Give your seed function a trailing `context?: Record<string, unknown>` parameter and pass it on to `createArticle` (or to any `payload.create` / `update` you call directly). `pnpm dev:db-seed` runs outside Next.js with `{ disableRevalidate: true }`, and without it the page revalidation in Payload hooks throws. `tests/integration/seed.test.ts` catches a missed one. See [`making-seeds.md`](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/src/endpoints/seed/making-seeds.md) for the full pattern.

## Utility Functions

### Rich Text Utilities (`richtext.ts`)

**Basic Functions:**

- `createTextNode(text, format?)` - Creates a text node
- `createParagraph(text | textNode | array)` - Creates a paragraph with text/nodes
- `createEmptyParagraph()` - Creates a line break paragraph
- `createRichText(children)` - Wraps paragraph nodes in root structure

**High-Level Functions:**

- `createRichTextFromString(text)` - Single paragraph from string
- `createRichTextFromParagraphs(paragraphs[], addSpacing?)` - Multiple paragraphs with auto-spacing
- `createLoremIpsumContent(numParagraphs)` - Lorem ipsum for testing

**Lorem Ipsum Generators:**

- `generateLoremIpsumParagraph(numSentences)` - Single paragraph
- `generateLoremIpsumParagraphs(numParagraphs)` - Array of paragraphs

### Media Utilities (`media.ts`)

- `fetchFileByURL(url)` - Fetches a file from URL, returns Payload File object
- `createMediaFromURL(payload, url, alt, additionalData?)` - Fetches and creates media in one call
  - `additionalData` supports: `{ caption: LexicalContent }`

### Article Utilities (`articles.ts`)

- `createArticle(payload, options, context?)` - Creates a published article with defaults
- `validateWriters(writers)` - Throws if no writers provided
- `getWriterOrThrow(writers, index)` - Gets writer by index with validation

### Block Helpers (in feature files)

**Media Blocks:**

```typescript
createMediaBlock(mediaId) // Single image block
```

**Media Collage Blocks:**

```typescript
createMediaCollageBlock(mediaIds[], layout) // 'grid' or 'carousel'
```

TODO

- Add createFootnotesBlock
- Add createMathBlock
- Export createSocialEmbedBlock
