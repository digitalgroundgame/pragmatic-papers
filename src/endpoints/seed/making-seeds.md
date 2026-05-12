# Creating Seed Scripts for Articles and Features

Seed scripts populate the database with sample content for development. Rather than writing seeds by hand, use an AI assistant to generate them from article JSON exports.

## Quick Start

1. **Export your article** - Visit `localhost:8000/api/articles/{id}` to get the article JSON
2. **Feed it to an AI assistant** along with this documentation
3. **The AI will generate** a seed script using our utility functions

## Available Utility Functions

### Rich Text Utilities (`richtext.ts`)

**Basic Functions:**

- `createTextNode(text, format?)` - Creates a text node
- `createLinkNode(text, url, newTab?)` - Creates a link node
- `createParagraph(text | textNode | array, format?)` - Creates a paragraph with text/nodes
- `createEmptyParagraph()` - Creates an empty paragraph (used internally for spacing between paragraphs)
- `createRichText(children)` - Wraps paragraph nodes in root structure

**High-Level Functions:**

- `createRichTextFromString(text)` / `createRichTextContent(text)` - Single paragraph from string (aliases)
- `createRichTextFromParagraphs(paragraphs[], addSpacing?)` - Multiple paragraphs with auto-spacing between them
- `createLoremIpsumContent(numParagraphs)` - Lorem ipsum for testing

**Lorem Ipsum Generators:**

- `generateLoremIpsumParagraph(numSentences)` - Single paragraph string
- `generateLoremIpsumParagraphs(numParagraphs)` - Array of paragraph strings

**Table Utilities:**

- `createTableHeaderNode(text)` - Creates a `<th>` header cell
- `createTableCellNode(text)` - Creates a `<td>` data cell
- `createTableRowNode(cells)` - Creates a table row from an array of cell nodes
- `createTableNode(rows)` - Creates a table from an array of row nodes

### Media Utilities (`media.ts`)

- `fetchFileByURL(url)` - Fetches a file from URL, returns Payload File object
- `createMediaFromURL(payload, url, alt, additionalData?)` - Fetches and creates media in one call; strips `additionalData` on the final retry attempt
  - `additionalData` is `Partial<Omit<Media, "id" | "alt">>` — supports any optional Media field (e.g. `{ caption: LexicalContent }`)

### Article Utilities (`articles.ts`)

- `createArticle(payload, options, context?)` - Creates a published article with defaults; retries up to 3 times on Drizzle errors

```typescript
interface CreateArticleOptions {
  title: string
  content: LexicalContent
  authors: number[]
  topics?: number[]
  slug: string
  heroImage?: number | null
  meta?: {
    title?: string | null
    description?: string | null
    image?: number | null
  }
}
```

- `validateWriters(writers)` - Throws if no writers provided
- `getWriterOrThrow(writers, index)` - Gets writer by index with validation (wraps with modulo so index is always valid)

### Block Helpers (defined locally in each feature file)

Block helpers are small factory functions defined at the top of each feature file — they are **not** shared exports. Copy the pattern into your own feature file:

**Media block:**

```typescript
function createMediaBlock(mediaId: number) {
  return {
    type: "block",
    fields: { blockType: "mediaBlock", media: mediaId },
    format: "",
    version: 2,
  }
}
```

**Media collage block:**

```typescript
function createMediaCollageBlock(mediaIds: number[], layout: "grid" | "carousel" = "grid") {
  return {
    type: "block",
    fields: { blockType: "mediaCollage", layout, images: mediaIds.map((id) => ({ media: id })) },
    format: "",
    version: 2,
  }
}
```

**Math block helpers (exported from `features/math-blocks.ts`):**

Unlike the media helpers above, the math helpers are exported and can be imported into other feature files:

```typescript
import { createMathInlineBlock, createMathDisplayBlock } from "./math-blocks"

createMathInlineBlock("E = mc^2") // inline LaTeX within a paragraph (version: 1, inlineBlock)
createMathDisplayBlock("\\int_0^1 x") // standalone display block (version: 2, block)
```

## How to Generate a Seed from Article JSON

When generating a seed from article JSON:

1. **Analyze the content structure** - Identify paragraphs, blocks, media, and any special content types
2. **Identify media requirements** - Note all media used in the article
3. **Request external URLs from the user** - The JSON contains local dev server URLs (e.g., `/api/media/file/...`) which won't work in seed scripts
   - List all media items with their alt text and captions
   - Request publicly accessible URLs for each (CDN, GitHub raw, image hosting services, etc.)
   - Wait for user to provide URLs before proceeding
4. **Replace hardcoded IDs** - Use function parameters for media/author IDs instead of JSON IDs
5. **Build content programmatically** - Use utility functions, don't copy raw JSON structure
6. **Create helper functions** - Extract repeated block patterns into reusable functions
7. **Follow existing patterns** - Reference `features/footnotes.ts` or `features/media-collage.ts` as examples

### Important: Media URLs

⚠️ **Do NOT use URLs from article JSON** (e.g., `/api/media/file/image.jpg`) - these point to the local development server and won't work in seed scripts.

**Instead:**

- Ask the user to provide external URLs for each media item
- Use publicly accessible URLs (CDN, GitHub raw, image hosting services, etc.)
- Example: `https://raw.githubusercontent.com/org/repo/main/image.jpg`

## Seed File Structure

```typescript
import type { Payload } from "payload"
import type { User, Media } from "@/payload-types"
import { createMediaFromURL } from "../media"
import { createRichText, createParagraph, createTextNode } from "../richtext"
import { createArticle } from "../articles"

// Helper functions for custom blocks
function createMyCustomBlock(data) {
  return {
    type: "block",
    fields: { blockType: "myBlock", ...data },
    format: "",
    version: 2,
  }
}

export const createMyFeatureArticle = async (
  payload: Payload,
  writers: User | User[],
  mediaDocs: Media[],
  topics: number[],
): Promise<number> => {
  // Create any additional media
  const customMedia = await createMediaFromURL(
    payload,
    "https://example.com/image.jpg",
    "Alt text",
    { caption: createRichTextFromString("Caption text") },
  )

  // Build content programmatically
  const content = createRichText([
    createParagraph("Introduction paragraph"),
    createMyCustomBlock({
      /* data */
    }),
    createParagraph([
      createTextNode("Text with "),
      {
        type: "inlineBlock",
        fields: {
          /* inline block data */
        },
      },
      createTextNode(" more text"),
    ]),
  ])

  // Create the article
  const writer = Array.isArray(writers) ? writers.map((writer) => writer.id) : [writer.id]
  const article = await createArticle(payload, {
    title: "My Feature Demo",
    content,
    authors: writer,
    topics,
    slug: "my-feature-demo",
    meta: {
      description: "Description of the feature",
      image: mediaDocs[0]?.id,
    },
  })

  return article.id
}
```

## Example: Converting JSON to Seed

**Given article JSON with:**

- Title: "Example Article"
- Content with paragraphs and media blocks
- Media with captions (showing local URLs like `/api/media/file/...`)

**AI should first ask:**

> "I see this article uses 2 media items. The JSON shows local dev server URLs which won't work for seeding. Please provide external URLs for:
>
> 1. Media with alt text 'alt1' and caption 'Caption 1'
> 2. Media with alt text 'alt2' and caption 'Caption 2'"

**Then AI generates:**

```typescript
export const createExampleArticle = async (payload, writers, mediaDocs, topics) => {
  // Create media with captions (using external URLs provided by user)
  const [media1, media2] = await Promise.all([
    createMediaFromURL(
      payload,
      "https://example.com/images/image1.jpg", // External URL from user
      "alt1",
      { caption: createRichTextFromString("Caption 1") },
    ),
    createMediaFromURL(
      payload,
      "https://cdn.example.com/image2.png", // External URL from user
      "alt2",
      { caption: createRichTextFromString("Caption 2") },
    ),
  ])

  // Build content
  const content = createRichText([
    createParagraph("First paragraph from JSON"),
    createMediaBlock(media1.id),
    createParagraph("Second paragraph from JSON"),
  ])

  // Create article
  const writer = Array.isArray(writers) ? writers[0]! : writers
  return await createArticle(payload, {
    title: "Example Article",
    content,
    authors: [writer.id],
    topics,
    slug: "example-article",
    meta: { description: "Example description", image: media1.id },
  })
}
```

## Tips for AI Assistants

- **Never copy raw JSON** - Always use utility functions
- **ASK for external media URLs** - DO NOT use URLs from JSON (they're local dev server paths)
- Parse the JSON to identify all media items (check alt text, captions)
- Ask user: "Please provide external URLs for [list media with descriptions]"
- Wait for user to provide URLs before generating the seed
- **Build content incrementally** using `createParagraph()` and helpers
- **Create helper functions** for repeated block patterns
- **Handle inline blocks** (footnotes, etc.) as objects in paragraph children arrays
- **Use TypeScript types** from `@/payload-types` for type safety
- **Match existing patterns** - Look at `features/footnotes.ts` or `features/media-collage.ts` as examples

## Registering New Seeds

Add your seed to `index.ts`:

```typescript
import { createMyFeatureArticle } from "./features/my-feature"

// In the seed() function (inside a step fn, where ctx is available):
await createMyFeatureArticle(payload, ctx.writers[0]!, ctx.media, [ctx.topics[0]!, ctx.topics[3]!])
```

---

## Error Handling in Seeds

> **Background:** `@payloadcms/drizzle@3.79.1` has a known bug in `buildQuery` and `transformArray` that causes `TypeError: Cannot read properties of undefined (reading '_uuid')` or `...(reading 'id')` when the Drizzle adapter's internal `tables` map has an undefined entry. Two things trigger this during seeding:
>
> 1. **Next.js hot-reloads** — the dev server recompiles mid-seed (triggered by `Generating import map` cycles), which resets the Drizzle adapter state. The very next `payload.create` / `payload.find` call after a recompile hits the uninitialised adapter.
> 2. **Partially-cleaned DB state** — when `payload.delete` is called on a versioned collection, Payload's internal version cleanup can fail silently, leaving orphaned records. Subsequent operations (e.g. `enforceMaxVersions` → `findVersions`) then crash in `buildQuery`.
>
> The seed runs on a live dev server against a real Postgres instance, so either trigger can surface on any re-seed run. Seeds must handle them gracefully.

### The Golden Rule

**All `payload.create` calls in seeds should have a fallback.** A seed that crashes halfway is worse than a seed that succeeds with slightly less data — a partial seed corrupts the `ctx` state that downstream steps depend on.

### Pattern 1: Retry loop with backoff

For any `payload.create` that can be affected by a hot-reload mid-seed, use a retry loop with exponential backoff. Hot-reload errors are transient — retrying with the same data is sufficient. Don't strip fields on the final attempt for collections where required fields (like `authors`) would cause type errors or where stripping core content produces a useless document.

```typescript
async function createArticle(payload: Payload, options: CreateArticleOptions): Promise<Article> {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await payload.create({ collection: "articles", data: { ...options } })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (attempt < maxAttempts) {
        payload.logger.warn(
          `Article create attempt ${attempt}/${maxAttempts} failed for "${options.slug}", retrying. Error: ${message}`,
        )
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      } else {
        throw err
      }
    }
  }

  throw new Error(`Failed to create article "${options.slug}" after ${maxAttempts} attempts`)
}
```

For non-versioned collections without hot-reload risk (e.g. users), a single try/catch with an immediate minimal-fields retry is sufficient:

```typescript
async function createUser(payload: Payload, data: UserData, label: string): Promise<User> {
  try {
    return await payload.create({ collection: "users", data })
  } catch (err) {
    payload.logger.warn(
      `Failed to create ${label} with full data, retrying with minimal fields. Error: ${err instanceof Error ? err.message : String(err)}`,
    )
    const { email, password, name, role, slug } = data
    return await payload.create({
      collection: "users",
      data: { email, password, name, role, slug },
    })
  }
}
```

See: `articles.ts` → `createArticle`, `users.ts` → `createUser`

### Pattern 2: Create-or-update (for versioned collections with unique slugs)

Versioned collections (Pages, Volumes) have `drafts.autosave: true`. When a document is deleted, Payload tries to clean up its versions. If that version cleanup fails internally (a known Drizzle bug), the page/volume row IS deleted but version records linger. On the next seed run, creating the same slug succeeds at the DB level but Payload's unique validation rejects it.

Use a create-or-update pattern: try `payload.create`, and if the error mentions "slug", find the existing document by slug and `payload.update` it instead.

```typescript
async function createOrUpdatePage(payload: Payload, data: PageData): Promise<Page> {
  try {
    return await payload.create({ collection: "pages", data })
  } catch (err) {
    const isSlugConflict = err instanceof Error && err.message.toLowerCase().includes("slug")
    if (!isSlugConflict) throw err

    const existing = await payload.find({
      collection: "pages",
      where: { slug: { equals: data.slug } },
      limit: 1,
    })
    const existingPage = existing.docs[0]
    if (!existingPage) throw err

    payload.logger.warn(
      `Page slug "${data.slug}" already exists (id: ${existingPage.id}), updating instead of creating.`,
    )
    return await payload.update({ collection: "pages", id: existingPage.id, data })
  }
}
```

See: `pages.ts` → `createOrUpdatePage`, `volumes.ts` → `createOrUpdateVolume`

Volumes combine both patterns — retry loop for Drizzle errors, slug-conflict upsert handled inline, and a minimal-fields strip on the final attempt. Stripping is safe here because `editorsNote` (richText) and `articles` (relationship) are optional, unlike articles where `content` and `authors` are core:

```typescript
async function createOrUpdateVolume(payload: Payload, data: VolumeData): Promise<Volume> {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isLastAttempt = attempt === maxAttempts

    try {
      if (isLastAttempt) {
        const { title, volumeNumber, description, slug, _status, publishedAt } = data
        return await payload.create({
          collection: "volumes",
          data: { title, volumeNumber, description, slug, _status, publishedAt },
        })
      }

      return await payload.create({ collection: "volumes", data })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      if (message.toLowerCase().includes("slug")) {
        // slug conflict → upsert regardless of attempt
        const existing = await payload.find({
          collection: "volumes",
          where: { slug: { equals: data.slug } },
          limit: 1,
        })
        const doc = existing.docs[0]
        if (!doc) throw err
        payload.logger.warn(`Volume slug "${data.slug}" already exists, updating.`)
        return await payload.update({ collection: "volumes", id: doc.id, data })
      }

      if (attempt < maxAttempts) {
        payload.logger.warn(
          `Volume create attempt ${attempt}/${maxAttempts} failed for "${data.slug}", retrying. Error: ${message}`,
        )
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      } else {
        payload.logger.warn(
          `Failed to create volume "${data.slug}" with full data, retrying with minimal fields. Error: ${message}`,
        )
      }
    }
  }

  throw new Error(`Failed to create volume "${data.slug}" after ${maxAttempts} attempts`)
}
```

### Pattern 3: Unique filenames for media uploads

Payload always calls `docWithFilenameExists` before uploading, which runs a `buildQuery` to check for conflicts. If the adapter has been reset by a hot-reload, this query crashes regardless of whether there is actually a conflict.

Two things work together to handle this:

1. **Timestamp prefix** — prefixing filenames with `Date.now()` ensures the name is always unique, so Payload never tries to generate an incremented name (e.g. `image-post1-2.webp`) which would trigger a _second_ `buildQuery` call and a second crash.

2. **Retry loop in `createMediaFromURL`** — if the initial `docWithFilenameExists` query crashes due to a hot-reload-reset adapter, the retry lets the adapter reinitialise before the next attempt.

```typescript
const baseName = url.split("/").pop() || `file-${Date.now()}`
const name = `${Date.now()}-${baseName}` // e.g. 1774132662098-image-post1.webp
```

See: `media.ts` → `fetchFileByURL`, `createMediaFromURL`

### Pattern 4: Wrap each step with context in `index.ts`

The main seed loop wraps each step so failures include the step name:

```typescript
try {
  await fn()
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  throw new Error(`Seed step "${name}" failed: ${message}`, { cause: err })
}
```

This surfaces `Seed step "Creating volumes..." failed: ...` instead of a raw stack trace, making it immediately clear which step to investigate.

### Field types that trigger Drizzle bugs

These field types are known to cause internal Drizzle errors in v3.79.1 when the DB is in a partially-cleaned state. Always strip them from fallback retry data:

| Field type                | Example                                  | Safe to strip in fallback? |
| ------------------------- | ---------------------------------------- | -------------------------- |
| `array`                   | `socials`, `links`                       | Yes — typically optional   |
| `richText`                | `biography`, `editorsNote`               | Yes — typically optional   |
| `upload` / `relationship` | `profileImage`, `meta.image`, `articles` | Yes — use `null` or omit   |
| `blocks`                  | page `layout`                            | Caution — may be required  |

Scalar fields (`text`, `number`, `select`, `date`, `checkbox`) are safe and should always be included in the fallback.

### What NOT to do

- **Don't swallow errors silently** — always `payload.logger.warn` before retrying so the partial fallback is visible in logs
- **Don't omit required fields** in fallback data — check the collection config for `required: true` fields
- **Don't assume `payload.delete({ collection, where: {} })` is clean** — Drizzle version cleanup can fail silently, leaving orphaned records that cause conflicts on the next run
- **Don't pass `undefined` to relationship fields** — use `null` explicitly; `undefined` can trigger internal type errors in Payload's relationship processor
