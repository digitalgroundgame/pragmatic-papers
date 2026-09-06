---
name: interactive-maps
description: Build a map — a choropleth Interactive Map block in an article (regions shaded by a value), or an interactive page (an overview map whose regions open into their children and records, fed by a researcher's data feed). Covers preparing the pre-projected SVG, uploading to Map Assets, configuring the block, snapshotting drilldown geometry, the ownership split and validating before upload. Use whenever a writer wants regions shaded by a value (election margins, turnout, per-capita rates), an overview-to-detail map (circuits → districts → judges, states → counties → returns), or when a map renders blank, all-neutral, without tooltips, or drills into nothing.
---

# Authoring an Interactive Map

Two things live here, and they are chosen by what the map _is_, not by a field:

- **A choropleth**, as an **Interactive Map block** in an article: regions from
  a **pre-projected SVG**, shaded by a value, with hover/focus tooltips. Fully
  server-rendered, no runtime fetch. The first half of this document.
- **A drilldown**, as an **interactive page** at `/interactives/<slug>`: one
  overview map you drill into. Pick a region and the view morphs into that
  region's children while a pane fills with the records that belong to it.
  Child geometry and records load only on drill-in, and the data comes from a
  researcher's feed a job syncs on a schedule. See
  [Drilldown geometry](#drilldown-geometry) and
  [Interactive pages](#interactive-pages--drilldown-from-a-synced-feed).

Both render inline SVG — no map library, no client-side projection. The
difference is where the SVG goes. A choropleth's SVG is **uploaded** to Map
Assets by a writer and read at render time. A drilldown's SVG is **checked in**
by a developer, parsed once at snapshot time into `geometry/*.json`, and never
parsed again; its facts and records arrive separately, from the feed.

> A drilldown is not a block mode. An SVG never carries records.

## Choropleth mode

That makes the SVG a **contract**, and the failure modes are quiet: a file that
breaks the contract renders blank, all-grey, or inert rather than erroring.
Validate before uploading (below) instead of eyeballing the admin preview.

Source of truth is the code in **`src/blocks/InteractiveMap/`** — chiefly
`sanitize.ts` (what survives), `parseInlineSvg.ts` (what is read), and
`colorScale.ts` (how values become colors). This is the checklist.

## Is a choropleth the right map?

A choropleth encodes value as **fill color over area**, so the reader's eye
weights each region by how much space it takes up. That is the right call when
the value is already area-normalized — a rate, a share, a per-capita figure, a
margin — and every region is a meaningful unit on its own.

It misleads when the story is about **counts of people**. Sparse rural
districts dominate the frame while dense urban ones vanish, which is the whole
"land doesn't vote" problem with a red-and-blue election map. If that gap is
the story, say so in the copy, pair the map with a table or chart carrying the
population weights, or reconsider the map entirely.

Choropleth mode draws **only** choropleths — no cartogram, hex/tile grid,
proportional-symbol, or dot-density mode, and no point/marker layer, since a
path with no `id` is inert by design. An overview-to-detail story is the
an [interactive page](#interactive-pages--drilldown-from-a-synced-feed), not a
choropleth with overlapping paths.

## The contract

An SVG the block can render looks like this — nothing else is needed, and
almost nothing else survives:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
  <g transform="scale(1,-1) translate(0,-552650.6)">
    <path id="MO-01" data-label="MO District 1" data-margin="-58.18" d="M … Z"/>
    <path id="MO-02" data-label="MO District 2" data-margin="11.7"  d="M … Z"/>
  </g>
</svg>
```

1. **Already projected.** Nothing reprojects at render time. Project to a
   planar CRS (the seeded Missouri maps use Albers Equal Area, ESRI:102003)
   before export. Geographic data is y-up and SVG is y-down, so exports
   normally carry a `scale(1,-1) translate(…)` flip on the wrapping group.
2. **`viewBox` on the root `<svg>`.** Without it the block falls back to
   `0 0 100 100` and the map is a speck in the corner. Width/height are
   ignored — the map scales to its container.
3. **One `<path>` per region, each with an `id`.** The `id` is the join key:
   it is what tooltips, colors, and the Overrides table hang off. A path with
   no `id` still draws, but it is inert — no color, no hover, no keyboard
   focus. That is the right way to include decorative geometry (borders,
   coastlines, inset frames).
4. **Optional `data-label`** — the human-readable name in the tooltip. Without
   it the tooltip shows the raw `id` (`MO-01`).
5. **Optional numeric `data-*` value** (e.g. `data-margin="-58.18"`) — see
   [Getting values in](#getting-values-in).

Multiple paths may share one `id` (a district split across islands): they all
color and highlight together, and the label/value come from the first one.

### What the sanitizer keeps

Uploaded SVG is run through `sanitizeMapSvg` before parsing. Only these
survive:

| Kept tags                                 | Kept attributes                                                                                                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<svg>` `<g>` `<path>` `<title>` `<desc>` | `id` `class` `style` `transform` `d` `viewBox` `preserveAspectRatio` `fill` `stroke` `stroke-width` `stroke-linecap` `stroke-linejoin` `vector-effect` `role` `tabindex`, any `data-*`, any `aria-*` |

Everything else is dropped **silently**, in one of two ways:

- **Shape and text tags lose their geometry outright** — `<rect>` `<circle>`
  `<ellipse>` `<polygon>` `<polyline>` `<line>` `<text>` `<image>`, and the
  attributes that carry their coordinates (`x`, `y`, `points`, `href`, …). A
  QGIS or Illustrator export usually loses most of its shapes here.
- **Container tags are unwrapped, and their children are promoted** —
  `<defs>` `<clipPath>` `<mask>` `<foreignObject>`. A `<path>` parked inside
  `<defs>` as a `<use>` template does not disappear; it becomes an ordinary
  region drawn on the map, while the `<use>` instances that positioned it are
  gone. (`<style>` and `<script>` are the exception: tag _and_ contents go.)

So before uploading: **flatten every shape to `<path>`**, expand `<use>`
instances into real paths, delete leftover `<defs>` templates, convert text to
outlines or drop it, and inline any styling that lived in `<style>` as
presentation attributes. In QGIS, "Render as SVG" plus an SVG-editor "object
to path" pass gets you there; in Illustrator, expand appearance and save as
SVG with **Style Attributes** (not internal CSS).

Only the **first `<g>`** contributes a `transform`. Nested-group transforms are
dropped, so flatten the group tree to a single wrapper — and make sure that
first group is the real map wrapper, not a leftover container the sanitizer
unwrapped ahead of it.

## Getting values in

Two ways to attach a number to a region. Prefer the first.

**Via the SVG (`Data Attribute` field).** Put the number on each path — e.g.
`data-margin="-58.18"` — and set the block's **Data Attribute** to
`data-margin`. Values are read straight out of the file, no manual data entry.
This is the only sane path past a handful of regions; generate the attribute
in the export script alongside the geometry.

**Via the Overrides table.** Add a row per region with the **Region ID**
matching the path's `id`, then set label, value, and/or color. Overrides win
over the SVG for whatever they set. Use them for a one-off correction, an
annotated outlier, or a map with three regions — not to hand-key 435 rows.

The **attribute name picks the number formatting**, via `inferValueFormat`:

| Data Attribute           | Tooltip shows       | Notes                                    |
| ------------------------ | ------------------- | ---------------------------------------- |
| `data-margin`            | `R+58.2` / `D+12.4` | Signed: **positive = R+, negative = D+** |
| `data-percent`           | `58.2%`             |                                          |
| `data-number`            | `58.2` (localized)  |                                          |
| any other `data-*`       | `58.2` (localized)  | Falls through to plain number formatting |
| _(Data Attribute unset)_ | no value line       | Tooltip shows the label only             |

Rename the attribute and the tooltip formatting changes with it — that is the
whole mechanism, there is no separate format field.

## Validate before uploading

```bash
pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts path/to/map.svg --data-attribute data-margin
```

It runs the real sanitizer, parser, and color scale over the file and prints
what the block will see — viewBox, group transform, region count vs. inert
paths, which regions got values, and the resolved color per region — then
flags dropped tags, missing ids, and unvalued regions. Exits non-zero when the
map would render inert.

`--scale perRegion` and `--bias <n>` mirror the block's fields. Add
`--mode geometry` for a drilldown geometry file (see below).
`.claude/skills/interactive-maps/example-map.svg` is a minimal valid file to
copy from; `src/endpoints/seed/fixtures/mo-districts-119.svg` is a real one.

## Uploading to Map Assets

Interactive-map SVGs go in the **Map Assets** collection (`map-assets`), not
Media. Map Assets skips image processing so the vector data round-trips
intact, and a `beforeValidate` hook copies the file's text into a hidden
`svgContent` field — that captured text is what the block renders, so **a file
edited outside the CMS must be re-uploaded**, not swapped on disk.

- SVG only (`image/svg+xml` is the sole accepted mime type).
- `svgContent` caps at 2,000,000 characters (raised for drilldown overviews,
  which run ~800 KB with facts baked in). A dense export can still blow past
  that — simplify geometry (QGIS _Simplify_, or `mapshaper -simplify`) rather
  than trimming coordinate precision by hand.
- Set **Label** (shown in the admin picker) and **Source** (attribution link
  for the geometry). Writers see the label when choosing an asset in the
  block, so name it precisely — `MO Congressional Districts, 119th`, not
  `map2`.
- Writers and editors can create; a writer can only edit or delete assets they
  created.

## Configuring the block

The block lives in the Articles rich-text editor — add an **Interactive Map**
block inside the article body.

| Field                     | What it does                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Widget Title**          | Optional heading above the whole widget.                                                                                                                                                        |
| **Layout**                | `Side by side` / `Stacked` — how multiple maps are arranged. Both currently place maps in one column on phones and two columns from the `sm` breakpoint up, so the visible difference is small. |
| **Color Scale**           | `Diverging Red/Blue` (color by value) or `Per-region custom colors` (no automatic fill; you set every color yourself).                                                                          |
| **Color Bias**            | Warps the breakpoints — see below. Leave at `1` unless the map reads flat.                                                                                                                      |
| **Maps** (≥1)             | Each: **Title**, **Pre-projected SVG** (a Map Asset), **Data Attribute**, **Overrides**.                                                                                                        |
| **Sources / Attribution** | Links rendered as a small footer under the maps. Always credit the data source.                                                                                                                 |

Two or more maps in one block share the scale, bias, and legend — that is what
makes a before/after comparison honest. Give each a **Title** (`119th
Congress`, `120th Congress`).

Below the maps the block renders a legend (diverging scale only), the source
line, and an info tooltip showing the bias value.

### The diverging Red/Blue scale

Colors come from the **signed** value: positive → red (R+), negative → blue
(D+). Thresholds on the absolute value:

| \|value\| | Fill                    |
| --------- | ----------------------- |
| `< 1`     | neutral (no lean shown) |
| `1 – 5`   | lightest red / blue     |
| `5 – 15`  | light                   |
| `15 – 30` | strong                  |
| `≥ 30`    | deepest                 |

**Color Bias** slides those thresholds along a curve while pinning the ends.
Above `1`, breakpoints move toward the low end, so small margins already read
strongly — good for a map of genuinely close races. Below `1`, breakpoints
move toward the high end, so only blowouts saturate — good when a handful of
lopsided regions would otherwise wash the map out. The seeded Missouri article
uses `0.5`. The legend labels recompute from the bias, so the printed
thresholds always match what is on screen.

A region with no value, or `|value| < 1`, gets the neutral fill. With
**Per-region custom colors**, every region is neutral until you give it a color
in Overrides — that scale draws no legend and does not read values.

Note: **Invert Colors** (per map) exists but is hidden in the admin; it flips
the polarity for a map whose source data is signed the other way. Prefer fixing
the sign at export time.

## Troubleshooting

| Symptom                                            | Cause                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Block renders nothing at all                       | No SVG asset selected, or `svgContent` is empty (file uploaded as something other than `image/svg+xml`).                    |
| Map area is blank / a speck in the corner          | No `viewBox` on the root `<svg>` (fell back to `0 0 100 100`), or all geometry was in discarded elements.                   |
| Some shapes missing                                | They were `<rect>`/`<polygon>`/`<use>`/`<text>` — flatten to `<path>` and re-upload.                                        |
| A ghost region no one placed on the map            | A `<path>` left inside `<defs>`; the sanitizer unwraps the container and promotes it. Delete the template.                  |
| Map draws but every region is grey                 | Diverging scale with no values: **Data Attribute** unset, misspelled, or the paths carry no such attribute.                 |
| One region grey, the rest colored                  | That path has no numeric value, or `\|value\| < 1` (genuinely neutral).                                                     |
| No tooltip, no hover outline, no focus ring        | The path has no `id`.                                                                                                       |
| Tooltip shows `MO-01` instead of a name            | No `data-label` on the path and no **Override Label** row.                                                                  |
| Red and blue are the wrong way round               | Sign convention: positive must be R+. Fix the sign in the data — the per-map **Invert Colors** flag is hidden in the admin. |
| Tooltip value formatted wrong (`58.2` vs `R+58.2`) | Attribute name drives formatting — use `data-margin` for R+/D+.                                                             |
| Colors look washed out / uniformly saturated       | Tune **Color Bias**: `> 1` for close races, `< 1` when outliers dominate.                                                   |
| Map is upside down                                 | Missing the y-flip: the wrapping `<g>` needs `scale(1,-1) translate(0,-<height>)`.                                          |
| Fill/stroke set in the SVG is ignored              | Deliberate — region paths are filled by the scale. Only `id`-less decorative paths keep their own attributes.               |

## Drilldown geometry

One **overview** map of parent regions; pick one and the view zooms/morphs into
that region's **children** while a pane fills with the **records** that belong
to it. Courts → districts → judges is one instance; states → counties →
precinct returns, a country → provinces → indicators, a metro → neighborhoods →
records are the same feature. Nothing in the engine knows the vocabulary.

This section covers only the **SVG half**: the shapes and the hierarchy. Facts,
records, labels and colours are not in these files — they come from the feed
and from the profile's `presentation.ts`. See
[Interactive pages](#interactive-pages--drilldown-from-a-synced-feed) for those.

Source of truth is `src/blocks/InteractiveMap/drilldown/types.ts` (the engine's
input) and `src/interactives/geometry.ts` (the SVG → JSON snapshot step).

### Two kinds of file

**Overview** (`geometry/<name>.json`, snapshotted from one SVG) — every parent
region and, if you want them drawn, the child borders that cut them up, in one
national projection. Server-rendered on every page view, so the overview is
meaningful without JavaScript.

**Child geometry** (one per drillable parent) — that parent's children in the
parent's **own local projection**. Served as JSON from
`/interactives/<slug>/regions/<id>` only when a reader drills in. A parent with
no territory of its own still gets an entry, with no paths; the engine then
keeps the overview on screen and lists its children in the selector.

### Path attributes

```svg
<path id="ca8" data-region-label="8th Cir." data-layer="circuit" d="M … L …"/>
<path id="moed" data-parent-id="ca8" data-region-label="E.D. Mo." data-layer="district" d="…"/>
<path id="akd"  data-parent-id="ca9" data-inset="true" data-region-label="D. Alaska" d="…"/>
```

| Attribute           | Meaning                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | Region key. Unique within the file; a child file's path ids must match the overview's for the same region (that is what pairs shapes for the morph).                |
| `data-region-label` | Fallback display name. The feed normally supplies the label; without either, the raw `id` shows.                                                                    |
| `data-parent-id`    | Parent region key. **Absent → top-level region** (drillable); present → child. This is how the hierarchy is inferred; `data-layer` is only a name.                  |
| `data-layer`        | Free-form layer name (`circuit`, `district`, `county`…) kept on the rendered path for styling.                                                                      |
| `data-inset="true"` | An inset drawn in its own box (Alaska, Hawaii, a callout). On the overview it stands in for its parent (click Alaska → the 9th); it crossfades instead of morphing. |
| any other `data-*`  | **Dropped at snapshot time.** `svgToGeometryFile` keeps only the attributes above, so a file exported with facts baked in yields the same geometry as a clean one.  |

Multiple paths may share an id (islands as separate paths) but a single path
with several `M…L…` subpaths is better — separate paths morph independently.
The validator warns.

Path data that should **morph** must be **absolute `M`/`L` only**, and each
morphing shape must be exported twice from **one** simplification so the
overview and child versions share vertex count and order ("simplify once,
export twice"). Anything else is not an error: the engine detects it and falls
back to zoom + crossfade for that view, and the validator tells you which
shapes broke the invariant.

Both files carry a `<g transform="scale(1,-1) translate(0, -(minY+maxY))">`
Y-flip. The engine **recomputes the flip from the viewBox** rather than trusting
the string, and pads the viewBox 3% so edge strokes are not clipped.

### Validate before snapshotting

```bash
pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts national.svg --mode geometry
pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts circuits/ca8.svg --mode geometry --overview national.svg --region ca8
```

The overview run reports the hierarchy it infers and flags dangling
`data-parent-id`s, duplicate ids and paths that cannot morph. The paired run
additionally reports which shapes will morph and which fall back, and names the
shapes whose vertex counts differ between the two files.

## Interactive pages — drilldown from a synced feed

A long-lived page at `/interactives/<slug>` whose data a researcher keeps
updating, drawn by the same drilldown engine. The point of the design is an
**ownership split**:

| Layer            | Contains                                                          | Owner            | Lives in                                         |
| ---------------- | ----------------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| **Geometry**     | region shapes, ids, hierarchy                                     | Pragmatic Papers | `src/interactives/<profile>/geometry/*.json`     |
| **Presentation** | labels, colours, ordering, formats, seat grouping                 | Pragmatic Papers | `src/interactives/<profile>/presentation.ts`     |
| **Editorial**    | title, standfirst, sources, which profile, feed ref, publish gate | editors          | `interactives` collection                        |
| **Data**         | region facts and records (plus named extra datasets)              | the researcher   | their repo → `interactive-snapshots` (versioned) |

**The rule:** data carries values and meanings (`party: "D"`,
`status: "senior"`); code carries appearance (what colour "D" is). A feed cannot
set a colour, label or order: `src/interactives/compose.ts` reads `facts`,
`seats` and `display` from the profile and from nothing else, and empties
per-path facts from geometry. Source of truth: `src/interactives/types.ts`.

### How data flows

1. The researcher publishes what they already publish (court-tracker's
   `data/manifest.json` + the files it lists). Nothing on their side changes;
   the **adapter** (`src/interactives/<profile>/adapter.ts`) absorbs their
   shape and is ours to maintain.
2. `syncInteractiveData` runs daily (06:15 UTC) and from the **Sync data
   feeds** button on Interactive Snapshots (`POST
/api/interactive-snapshots/sync[?interactive=<id>&force=true]`). It reads
   the manifest, skips if upstream's `version` has not moved, fetches, adapts,
   **validates against the geometry** (every record's region must exist; a
   drawn shape the feed no longer declares, or a declaration with no shape
   under a drawn parent, fails — that is how an upstream rename shows up), and
   writes a new snapshot **version only when the content hash moved**.
3. The snapshot is a **draft** unless the interactive's feed is set to
   auto-publish. An editor opens the page from the admin (draft mode renders
   the newest draft) — that is the preview — and publishes it. A feed that
   fails validation never becomes a version, so the last good one keeps
   serving.
4. The page composes the overview server-side; regions load lazily as JSON
   from `/interactives/<slug>/regions/<id>`, composed the same way and cached
   by tag until the next publish.
5. **Record search** is a third composed view. `/interactives/<slug>/search`
   serves one entry per record — id, name and region, nothing else — named by
   the profile's `display.title` field, so a feed cannot decide what a result
   says. The client fetches it on the reader's first keystroke, filters in the
   browser, and a chosen result selects the record's region (drilling into its
   parent first when it is a child) and pins the record in the pane. A record
   needs an `_id` to be searchable: it is what the pane finds it by once the
   region's asset has loaded.

Private upstream: set `COURT_TRACKER_GITHUB_TOKEN` (fine-grained, contents:
read); `COURT_TRACKER_REPO` overrides the default repository. Without the
token the sync logs a warning and skips.

### Presentation — what the profile owns

`presentation.ts` exports `facts`, `seats` and `display`. Nothing here can come
from a feed.

- **`facts`** controls how region facts display: `labels` per key, `order`, and
  `hide`. Facts the `seats`/`display` configuration consumes are hidden
  automatically.
- **`seats`** draws the **seat block** glyph next to each region visible in the
  current view: one small square per seat (`totalFact`), coloured by group in
  the order given, remainder drawn as vacant. `anchorFact` names a fact holding
  `"x,y"` in the projected units of the file that region is drawn in (a
  district's anchor belongs to its circuit's child geometry, a circuit's to the
  overview); default is the centre of the shape's largest sub-path. `labelFact`
  puts a short label above the block.
- **`display`** maps record fields to the pane.

Records themselves come from the feed. Each carries `_region` (the region key),
`_id` (stable identity — required for search) and optionally `_role:
"associate"` for someone who sits beside the bench rather than in it (a Circuit
Justice). Everything else is opaque, referenced by `display`. Records for a
parent **and its children** travel in the parent's region route; small
cross-cutting sets go in the overview. The pane merges both.

| `display` key          | Meaning                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` / `shortTitle` | Full name field; compact label under the avatar. `title` also names the record in search results.                                                    |
| `image`                | `{ url, source?, license?, credit? }` fields. A plain hotlinked `<img>` with an initials fallback; a non-empty `credit` renders a photo credit line. |
| `category`             | `{ field, values: [{ value, label, shortLabel?, color }], other? }`. Colours the avatar ring, groups the seat chart, and drives the majority line.   |
| `order`                | Sort field (ISO date or number), ascending — the timeline order.                                                                                     |
| `status`               | `{ field, supernumerary: [values], labels }`. Supernumerary members sit outside the seat count: greyed, in the outer band, with Hide/Show/Include.   |
| `seatsFact`            | Region fact holding the number of seats; vacancies = seats − active members.                                                                         |
| `flags`                | `[{ field, label, symbol }]` booleans shown as a badge (★ Chief judge).                                                                              |
| `cohort`               | Field whose shared value lights up on hover (everyone appointed by the same president).                                                              |
| `marks`                | `[{ field, label }]` boolean fields offered as a "Mark:" toggle (dashed ring).                                                                       |
| `details`              | Lines in the docked detail panel, in order — see below.                                                                                              |

Detail lines: `{ field, label?, format?, when? }` with `format` one of `text`
(default), `date`, `years-since` ("12 yr 3 mo" from the date to today), `term`
(`endField` names the end date: "X served · Y remaining (expires D)" or, past
the end, "term expired D · holding over pending a successor"), `link` (the
field is an http(s) URL), or `reported` (shown only when the field is truthy,
with optional `basisField` and `sourceField` — write the label hedged:
"Reported to have a … affiliation"). `when` is
`{ field, in?, notIn?, truthy? }` on the record; have the adapter derive a
boolean when a condition needs more than one field.

**`portrait`** puts a face beside the value. A judge names their appointing
president; the president's photo is a fact about the _president_, so the feed
carries it once in a dataset rather than copied onto every judge. Declare where
to read it in `presentation.lookups`, then point a detail line at that table:

```ts
lookups: { presidents: { dataset: "presidents", image: "photo_url", source: "photo_source" } },
display: {
  details: [{ field: "appointing_president", label: "Appointed by", format: "portrait", lookup: "presidents" }],
}
```

The compose step turns the named dataset into the payload's `lookups`. A
dataset the feed does not carry yields no table and the line falls back to the
plain value, so a missing face costs the row nothing.

**The header line.** A profile may also declare `metaLine(input)`, a short
string shown beside "Data as of …". "Data as of" says when the _sync_ ran; a
tracker that has not moved in months looks identical to one that syncs nightly.
Federal Courts uses it to name the most recent commission in the snapshot.

Reserved region facts the feed may set: `summary` (one-line meta text under the
pane heading and in the tooltip), `children-label` (noun for the drill-in
control: "View **districts** →", default "details"), `order` (selector sort
key), `note` / `note-seats` (italic note under the records, the latter only in
the seat-chart view).

### The landing view

Before a reader picks a region the pane shows the profile's **summary** instead of an empty
hint: an overview of the whole dataset. A profile opts in by declaring `summary` on its
`InteractiveProfile`, a pair of functions — `compose` runs on the server and its result is
cached with the overview, so it must be serialisable; `render` turns that into a node and is
the only place that knows its type, which keeps the shape inside the profile.

The summary reaches the map through `useDrilldownSelection()`, so a reader can go from an
overview straight to the region it names. Outside a drilldown that hook returns null and the
component still renders, which is what makes it testable on its own.

Federal Courts shows two views: the Supreme Court's bench on the same dome the seat chart
uses, and every district judgeship in the numbered circuits as one square, laid out as a
cartogram of the country. The squares come from the feed's `arrangement` dataset, whose
per-cell `r`/`d`/`vacant` codes are **meanings**: `summary.ts` maps them onto the profile's own
party values and `presentation.ts` decides the colour, so the cartogram, the seat blocks and
the bench can never disagree. Upstream places blocks in drawing units rather than cells, so the
compose step recovers the grid pitch and normalises offsets to whole cells.

Federal Courts adds two charts to that landing view, both from the feed's
`appointments` dataset and both aggregated at compose time — per-year counts
and per-month buckets, about 6 KB, rather than the megabyte the raw history
weighs:

- **Change** — judges in active service by appointing party, as a stacked area
  on a **zero baseline**, not a wiggle-baseline streamgraph: the total is the
  size of the federal bench, which is itself worth reading. It starts a
  judicial generation after the history does, because a judge appointed before
  coverage begins is invisible and the early years would understate the bench;
  the caption says so.
- **Appointments** — one dot per appointment, stacked into the month it was
  commissioned, with the axis banded by president. A term's band comes from the
  **dominant president in each month**, so a straggler filed under an earlier
  president cannot smear a band across the whole chart and two non-consecutive
  terms stay two bands.

Both take their colours from `presentation.ts`, name every series in a legend
rather than relying on colour alone, and label only the endpoints.

### What the reader gets

- **Overview**: parent fills, child borders, stroke-only parent outlines, seat
  blocks with labels, hover outline + tooltip (label, summary, facts). Keyboard
  reachable: regions are focusable and Enter/Space selects, and the region strip
  is one tab stop with arrow-key movement.
- **Search**: a box above the region strip finds any record by name and takes
  the reader to it — the one question the map cannot answer.
- **Select** (map or region strip): the pane beneath the map fills with label,
  summary, facts, and the bench as a **Timeline** (commission order, vacancies
  parked at the end) or a **Seat chart** (semicircle over the seat count, first
  category | vacancies | rest, dotted majority line and count, supernumerary
  Hide/Show/Include), plus the **Mark** toggles, the associate chip, notes, and
  the sticky docked **detail** panel (hover fills it, click pins it). Escape
  closes and returns focus to the region it came from.
- **Drill in** ("View districts →"): a vertex morph from the overview
  projection into the child projection (620 ms, commit-rate capped), or zoom +
  crossfade where the invariant fails; the strip repopulates with the children
  and a back control.

### Archivability

The overview is complete in the initial HTML. Each region is referenced as
`<link rel="prefetch" href="/interactives/<slug>/regions/<id>">` — a stable,
same-origin path a crawler following same-origin references will capture — and
fetched from that same path on drill-in. Nothing load-bearing is fetched from a
third party; hotlinked photos are the one exception and degrade to initials. A
capture that includes the prefetched routes drills in; one that does not still
shows the full overview, strip, facts and any records carried in the overview.

### Adding an interactive

1. `src/interactives/<profile>/` with `presentation.ts`, `adapter.ts`,
   `feed.ts` (implements `FeedAdapter`), `geometry.ts` (lazy JSON imports) and
   `index.ts` exporting an `InteractiveProfile`; register it in
   `src/interactives/profiles.ts`.
2. Snapshot the geometry once from the upstream export and commit the JSON —
   for Federal Courts: `pnpm tsx scripts/snapshot-federal-courts.ts geometry --source ../court-tracker`.
3. Snapshot the data fixture the seed and tests use — a real adapter output:
   `pnpm tsx scripts/snapshot-federal-courts.ts data --source ../court-tracker`
   (or `--ref main` with the token set). This also validates the feed and
   prints every problem.
4. Create the **Interactive** in the admin (title, slug, profile, standfirst,
   sources, feed ref), press **Sync data feeds**, review the draft snapshot on
   the page, publish it.

### Troubleshooting (pages)

| Symptom                                                     | Cause                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Page says "no published data yet"                           | No snapshot is published for the interactive. Open Interactive Snapshots: publish the draft, or run the sync and then publish.       |
| Sync says "skipped — COURT_TRACKER_GITHUB_TOKEN not set"    | The upstream is private; set the token in the environment the job runs in.                                                           |
| Sync says "unchanged" but the researcher pushed             | Their manifest `version` did not move (they did not rebuild), or the rendered content is identical. Use `?force=true` to re-read.    |
| Sync fails with `geometry draws "x" but the feed declares…` | Upstream renamed or dropped a region id. Fix the adapter's mapping or re-snapshot the geometry; the last good snapshot still serves. |
| Colours or labels look wrong after a data update            | They cannot come from the feed; look at `presentation.ts` and the theme tokens.                                                      |
| Region route returns 404                                    | The region is not drillable (not a key of the profile's `geometry.children`), or there is no published snapshot.                     |
| A judge is missing from search                              | Their record has no `_id`, or no value in the profile's `display.title` field — `composeSearchIndex` skips both. Check the adapter.  |
| Summary shows "No district layout."                         | The feed carries no `arrangement` dataset, or its cells name districts the feed does not declare. Re-run the snapshot script.        |
| Cartogram blocks overlap or scatter                         | The grid pitch could not be recovered because upstream's offsets are no longer whole multiples of one cell. Check `cellPitch`.       |
| Searching finds nobody at all                               | `/interactives/<slug>/search` 404s (no published snapshot) or the box was never given a URL; the list says "Search is unavailable".  |
| Region missing from the strip                               | Its path has no `id`, or its `data-parent-id` names a parent that does not exist (it is then listed at the top level).               |
| "View … →" never appears                                    | The region is not a key of the profile's `geometry.children`, and it has no children in the overview.                                |
| Pane says "No records for this region"                      | No record in the feed has `_region` equal to that id. Re-run the snapshot script: it prints every problem.                           |
| Pane shows "Details could not be loaded"                    | The region route failed. Open `/interactives/<slug>/regions/<id>` in the browser.                                                    |
| Drill-in zooms and crossfades instead of morphing           | By design when shapes are not absolute `M`/`L` or vertex counts differ. The paired validator run names the shapes.                   |
| No seat blocks                                              | No `seats` in `presentation.ts`, or no region's facts carry `totalFact`.                                                             |
| Seat block in the wrong place                               | `anchor` is in the wrong projection — a district's anchor must be in its circuit's child geometry units.                             |
| Tooltip lists machine facts (`seats-r`, `anchor`)           | Add them to `facts.hide`, or reference them from `seats`/`display.seatsFact` so they hide automatically.                             |
| Facts show `Active count` instead of your wording           | Add `facts.labels`.                                                                                                                  |
| Map upside down in the child view only                      | The child SVG lacks the `scale(1,-1)` flip group (or has it while the overview does not); make both consistent, then re-snapshot.    |
| Photos never appear                                         | `display.image.url` names a field the records do not have, or the host blocks hotlinking; initials show instead.                     |

## Reference

- Block config and fields — `src/blocks/InteractiveMap/config.ts`
- Sanitizer allowlist — `src/blocks/InteractiveMap/sanitize.ts`
- Parser (id / value / transform extraction) — `src/blocks/InteractiveMap/parseInlineSvg.ts`
- Color scale, breakpoints, bias, formatting — `src/blocks/InteractiveMap/colorScale.ts`
- Map Assets collection — `src/collections/MapAssets/index.ts`
- Drilldown engine contract — `src/blocks/InteractiveMap/drilldown/types.ts`, `contract.ts`
- Drilldown rendering, regions, morph, seat layout, search — `src/blocks/InteractiveMap/drilldown/`
- Ownership split and composition — `src/interactives/types.ts`, `compose.ts`
- SVG → geometry snapshot — `src/interactives/geometry.ts`, `scripts/snapshot-federal-courts.ts`
- Worked examples — `src/endpoints/seed/features/interactive-maps/` (two choropleths with a shared scale) and `src/endpoints/seed/features/interactives/` (the Federal Courts page)
