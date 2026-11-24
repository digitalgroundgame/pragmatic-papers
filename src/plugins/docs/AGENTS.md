# Docs plugin

## Help docs and notifications

Each site's editors write its help docs in the admin (**Help → Docs**); code doesn't
ship them to deployed sites. Docs are the `docs` collection (`src/plugins/docs/`, the docs plugin), so they
can hold blocks and images like an article, and they nest in one tree (the nested
docs plugin, which the docs plugin applies): an area like Writing has no parent, its
sections sit under it, and their docs under them, so a doc is read at its place in
the tree, `/docs/<area>/<section>/<slug>` (`docsTree` and `docPaths` in
`src/plugins/docs/sections.ts`). Slugs stay unique across the docs, so the route
reads the last segment and redirects (temporarily) any other path to the doc's
place now. Editors own the tree: they move a doc by picking its parent, and drag siblings
into order (the collection is orderable). `/docs` shows the home doc
(`src/docs/home.md`), and `/docs/whats-new` lists every doc but the areas and
sections, newest first; the bell leaves those out too. Each area and section is a
doc of its own that introduces the docs under it, which its page lists. Writing
(articles, blocks, media) and Editing (pages, volumes, moderation, site settings) are
the areas today. There's no Admin area: an admin-only doc goes where its subject does,
and one whose `audience` leaves out writers sits in Editing (`repoDocs.test.ts`
checks). Each doc ends with Previous and Next links in the sidebar's order.

The Markdown in `src/docs/` is reference material for editors, and what `pnpm
dev:db-seed` loads so local dev has docs (`loadRepoDocs`, published, with its
pictures uploaded to Media). Deploys never seed, change or delete docs, so readers get
only what a site's editors wrote. The folders mirror the
tree: each doc is `<slug>.md`, the docs under it are in a `<slug>/` folder beside it
(`src/docs/writing/articles/footnotes.md`), and its pictures sit beside it, each
named for the doc (`<slug>-hero.webp`, `<slug>-drawer.webp`). Siblings load in their
`order` (front matter), then by slug. Docs a deploy seeded before still carry the
`sourceHash` they were seeded with, and their `seeded:docs:<slug>` records stay in the
key-value store.

A doc's front matter (`src/plugins/docs/docFile.ts`) holds its `title`, a
`navTitle` of 24 characters at most for the sidebar, a `summary` of a sentence
or two (the bell shows it), `publishedAt` (the day the release reaches
production; for a feature that shipped earlier, the day it did), `revisedAt`
when it changes later (shown as "Updated …" beside the date; the bell
keeps it under `publishedAt`), `heroImage` and `heroAlt` (1200×630, the bell's
thumbnail, the link preview's image and the banner above the doc's title; optional,
but give a doc one where a picture helps) and, for a
doc only some roles need, `audience` (e.g. `[editor]`; admins and chief editors
see every doc), and `order`, its place among its siblings. `audience` only decides who the bell tells: every published doc
is public at /docs, as the repo is. The body is Markdown the docs editor can
hold (headings, lists, bold, italic, inline code, links), plus pictures on a
line of their own, `![alt](<slug>-picture.webp)`, which become Media blocks.
Link to other pages by URL. Other blocks can't be written in Markdown.
`src/plugins/docs/__tests__/repoDocs.test.ts` and `markdown.test.ts` check every
doc.

To write one in the local admin instead (**Help → Docs**), `pnpm docs:export
<slug>` writes it into the folder its place in the tree names, copying the pictures
it uses beside it.

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
their sitemap is empty and the bell leaves docs out (a source's `enabled`); the Docs collection stays,
so editors can write docs before it's switched on. With
`notifications` off there's no bell; with `tours` off, `TourGate` doesn't mount
the tour provider and no Show me button appears.

The bell is built from the site's shadcn components (`src/components/ui/`).
Payload 3 has no Tailwind of its own, so `NotificationsMenu.css` brings in
Tailwind's theme and only the utilities those files use, without preflight, and
maps the shadcn tokens onto Payload's theme variables under `html[data-theme]`.
Another admin component on shadcn adds its files to that CSS's `@source` list.
