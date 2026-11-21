# Interactives

## Interactive maps

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

The Substack feed can't run a map, so it shows a picture of it
(`interactiveMapToImage`). `generateBlockImages` (an Articles `afterChange`
hook) draws it when the article is published, never while a feed is built:
`interactiveMapToSVG` shades the map with the component's own resolver,
`renderImage.ts` rasterizes it with `sharp` (on the Coolify app, where articles
are saved; the Worker only reads the result), and it's stored as a Media upload
named for a hash of the block's data and its maps' SVG (`feedImage.ts`). The
feed's query looks that name up, so an unchanged map isn't drawn twice, a
changed one gets a new picture, and the old one stays for posts Substack
already imported. A map with no picture gets the RSS feeds' link back to the
article. The block's download button (`download/`) draws the same picture in the
reader's browser, with the sources and the logo in a footer and the font embedded, in the theme the
page shows (`themePalette`), and saves it as a PNG for sharing. The text in the picture needs a font in the image
(both Dockerfiles install fontconfig and the site's own fonts as TTFs from their packages, Geist and Libertinus Serif, since fontconfig can't read woff2; a download embeds the site's woff2). Like the page, the titles and sources are in Libertinus Serif, scaled 112% as `fonts.ts` scales it, and the legend in Geist.

A **whip count** (`src/interactives/whip-count/`) is a third kind of interactive page, with no
map: a leadership vote tracked voter by voter. It is an `interactives` document with the
`whip-count` profile (`profileKind` in `src/interactives/profiles.ts`; `getProfile` returns
drilldown profiles only), at `/interactives/<slug>` like the others (the old
`/interactives/whip-counts/<slug>` redirects there), and the document adds a methodology note.
The count is one JSON document in its snapshot's `data` field, which `parseWhipCount`
(`model.ts`) checks on save. The daily sync skips whip counts; their snapshot is written by
pushes, the seed, and editors, who may create a snapshot or change its `data` only when it
holds a whip count (a map's feed stays the sync's), and saving restamps its hash and summary
(`whipCountSnapshotStamp`). An editor changes it row by row in a table
(`WhipCountDataField`: position, statement, source, bloc and tags), or pastes a whole count
with "Edit as JSON". The page shows the public count and lets a reader draft their own guess
of how the vote breaks, one voter at a time or a group at a time (a tag, the incoming or the
outgoing, and a bloc when `WhipCount` is given `showBlocs`; the page leaves blocs hidden for now),
kept in their browser only and hidden until they ask for it. Outgoing
members aren't counted until the reader ticks the box to count them. With a `voteAt` time in the data the page counts down to the vote. With an `updates`
schedule (times of day in a time zone) it names the next check for new statements, in the
reader's own time. The bars draw one
rectangle a voter, each opening a card with their source, and a button saves the public count
as a PNG with the logo (`picture.ts`, on the map block's `saveSVGAsPNG`). Its title puts the two leading
candidates' public backers ahead of the page's own (`whipCountTitle`, `seo.ts`), and its link
preview is drawn per count at `/next/whip-counts/<slug>/image` (`WhipCountCard`, with
`next/og`): the two head to head with any refusal forecast, one tick a voter, the countdown, the wordmark, and the time the count last changed (the snapshot's `syncedAt`) in the eyebrow. The brand orange stays on the frame, away from the candidates' colors. Its fonts are TTFs from their packages (`CARD_FONTS`, `cardFonts.ts`): Coolify reads the files, and the Worker, which has none, fetches the copies `pnpm build:worker` puts in its static assets.
The card replaces any meta image an editor picks on the SEO tab. The page's metadata names it with a query that changes with the count and the countdown's days
(`whipCountImagePath`), so the route keeps its own `Cache-Control` (a day at the edge). A job outside the
site can keep a count current with `POST /next/whip-counts/<slug>` (`Authorization: Bearer
<WHIP_COUNT_PUSH_TOKEN>`, closed while unset): the count is checked like a save and merged
into the snapshot's (`mergePushedCount` keeps the editors' blocs and tags; the first push
creates the snapshot), as a draft unless the interactive's "Auto-publish new snapshots" is
ticked (and even then while the snapshot has unpublished edits, which publishing would carry
live), and refused (409) while an editor holds the snapshot's lock, whose form would autosave
its older count over the push. Readers read the published count at
`/api/interactive-snapshots?where[interactive.slug][equals]=<slug>`. The seed and the showcase entry
`whip-counts-draft-your-own-leadership-vote` create one (a dated snapshot, without
quotations) and an article that links to it; creating it takes an editor's account.

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
