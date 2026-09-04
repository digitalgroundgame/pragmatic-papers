---
name: interactive-maps
description: Build a map for an article with the Interactive Map block — a choropleth (regions shaded by a value) or a drilldown (an overview map whose regions open into their children and records). Covers preparing the pre-projected SVG, baking facts and records into it, uploading to Map Assets, configuring the block and validating before upload. Use whenever a writer wants regions shaded by a value (election margins, turnout, per-capita rates), an overview-to-detail map (circuits → districts → judges, states → counties → returns), or when a map renders blank, all-neutral, without tooltips, or drills into nothing.
---

# Authoring an Interactive Map

The Interactive Map block has two **modes**, selected by the block's `mode`
field:

- **Choropleth** (default): regions from a **pre-projected SVG**, shaded by a
  value, with hover/focus tooltips. Fully server-rendered, no runtime fetch.
  The first half of this document.
- **Drilldown**: one overview map you drill into. Pick a region and the view
  morphs into that region's children while a pane fills with the records that
  belong to it. Child geometry and records load only on drill-in. See
  [Drilldown mode](#drilldown-mode) below.

Both take SVG out of the **Map Assets** collection, run it through the same
sanitizer, and render inline SVG — no map library, no client-side projection.
Everything the block knows comes out of the SVG file plus a handful of block
fields.

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
[drilldown mode](#drilldown-mode), not a choropleth with overlapping paths.

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

| Kept tags                                              | Kept attributes                                                                                                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<svg>` `<g>` `<path>` `<title>` `<desc>` `<metadata>` | `id` `class` `style` `transform` `d` `viewBox` `preserveAspectRatio` `fill` `stroke` `stroke-width` `stroke-linecap` `stroke-linejoin` `vector-effect` `role` `tabindex`, any `data-*`, any `aria-*` |

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
`--mode drilldown` for a drilldown asset (see below).
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
| **Mode**                  | `Choropleth` (fields below) or `Drilldown` (its own **Overview SVG** and **Region Assets** — see [Drilldown mode](#drilldown-mode)). Existing blocks have no value and render as choropleths.   |
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

## Drilldown mode

One **overview** map of parent regions; pick one and the view zooms/morphs
into that region's **children** while a pane fills with the **records** that
belong to it. Courts → districts → judges is one instance; states → counties →
precinct returns, a country → provinces → indicators, a metro → neighborhoods →
records are the same feature. Nothing in the block knows the vocabulary — it
all comes out of the assets a writer uploads.

The whole mode reads **self-contained SVG assets**: no collections, no runtime
API, no rows in Postgres. A writer's pipeline bakes the data into the files.
The reference pipeline is `scripts/bake-court-tracker-fixtures.ts`, which turns
the court-tracker repository's output into the seeded Federal Courts article's
assets; copy its shape for a new dataset.

Source of truth is `src/blocks/InteractiveMap/drilldown/types.ts` (the
contract) and `contract.ts` (validation). What follows is the checklist.

### Two kinds of asset

**Overview asset** (block field **Overview SVG**) — every parent region and,
if you want them drawn, the child borders that cut them up, in one national
projection. Its paths carry the region **facts**. Loaded and server-rendered on
every article view, so the overview is meaningful without JavaScript.

**Region assets** (block field **Region Assets**, one row per drillable parent,
pinned by **Region ID** to a path `id` in the overview) — that parent's
children in the parent's **own local projection**, plus the parent's and its
children's **records** as a `<metadata>` JSON payload. Fetched from a stable
same-origin URL only when a reader drills in. A parent with no geometry of its
own (a court with no territory) still gets a region asset — with no paths, just
`<metadata>` — and the block keeps the overview on screen while listing its
children in the selector.

### Path attributes (the reserved core)

```svg
<path id="ca8" data-region-label="8th Cir." data-layer="circuit"
      data-summary="11 authorized · 11 active · 6 senior · 0 vacant"
      data-children-label="districts" data-order="8"
      data-seats="11" data-seats-r="10" data-seats-d="1" data-anchor="484339,528618"
      data-authorized="11" data-active="11" d="M … L …"/>
<path id="moed" data-parent-id="ca8" data-region-label="E.D. Mo." data-layer="district" d="…"/>
<path id="akd"  data-parent-id="ca9" data-inset="true" data-region-label="D. Alaska" d="…"/>
```

| Attribute             | Meaning                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | Region key. Unique within the file; a child asset's path ids must match the overview's for the same region (that is what pairs shapes for the morph).                             |
| `data-region-label`   | Display name in the selector, tooltip and pane heading. Without it the raw `id` shows.                                                                                            |
| `data-parent-id`      | Parent region key. **Absent → top-level region** (drillable); present → child. This is how the hierarchy is inferred; `data-layer` is only a name.                                |
| `data-layer`          | Free-form layer name (`circuit`, `district`, `county`…) kept on the rendered path for styling.                                                                                    |
| `data-inset="true"`   | An inset drawn in its own box (Alaska, Hawaii, a callout). On the overview it stands in for its parent (click Alaska → the 9th); it crossfades instead of morphing.               |
| `data-summary`        | One-line meta text under the pane heading and in the tooltip.                                                                                                                     |
| `data-children-label` | Noun for the drill-in control: "View **districts** →". Default "details".                                                                                                         |
| `data-order`          | Selector sort key (number). Unordered regions sort by label.                                                                                                                      |
| `data-note`           | Italic note under the records in the pane. `data-note-seats` shows only in the seat-chart view.                                                                                   |
| any other `data-*`    | An opaque **fact**: shown in the tooltip and pane as "Label: value". The label is the attribute name humanised (`active-count` → "Active count") unless the payload overrides it. |

Multiple paths may share an id (islands as separate paths) but a single path
with several `M…L…` subpaths is better — separate paths morph independently and
only the first one's facts count. The validator warns.

Path data that should **morph** must be **absolute `M`/`L` only**, and each
morphing shape must be exported twice from **one** simplification so the
overview and child versions share vertex count and order ("simplify once,
export twice"). Anything else is not an error: the block detects it and falls
back to zoom + crossfade for that view, and the validator tells you which
shapes broke the invariant.

Both files carry a `<g transform="scale(1,-1) translate(0, -(minY+maxY))">`
Y-flip. The block **recomputes the flip from the viewBox** rather than trusting
the string, and pads the viewBox 3% so edge strokes are not clipped.

### The `<metadata>` payload

One JSON object in a `<metadata>` element directly under `<svg>`, XML-escaped
(`&` → `&amp;`, `<` → `&lt;`). Schema `pragmatic-papers/drilldown-map@1`.
Every key is optional except `schema`; fact keys may be written with or without
the `data-` prefix.

```json
{
  "schema": "pragmatic-papers/drilldown-map@1",
  "regions": [
    { "id": "cafc", "label": "Fed. Cir.", "facts": { "seats": "12", "anchor": "2029097,935444" } },
    { "id": "cit", "label": "CIT", "parentId": "cafc", "facts": { "seats": "9" } }
  ],
  "facts": {
    "labels": { "authorized": "Authorized judgeships" },
    "order": ["full-name", "tenure"],
    "hide": ["internal-id"]
  },
  "seats": {
    "totalFact": "seats",
    "groups": [
      { "fact": "seats-r", "label": "R-appointed", "color": "var(--map-positive-3, #e54858)" },
      { "fact": "seats-d", "label": "D-appointed", "color": "var(--map-negative-3, #2c86ed)" }
    ],
    "vacant": { "label": "Vacant" },
    "anchorFact": "anchor",
    "labelFact": "short-label"
  },
  "records": {
    "items": [
      {
        "_region": "ca8",
        "full_name": "…",
        "president_party": "Republican",
        "status": "active",
        "commission_date": "1990-10-12"
      }
    ],
    "display": { "…": "see below" }
  }
}
```

- **`regions`** declares geometry-less regions (a court with no territory). They
  appear in the selector and, with an `anchor` fact, as a seat block.
- **`facts`** controls how path facts display: `labels` per key, `order`, and
  `hide`. Facts the `seats`/`records` configuration consumes are hidden
  automatically.
- **`seats`** draws the **seat block** glyph next to each region visible in the
  current view: one small square per seat (`totalFact`), coloured by group in
  the order given, remainder drawn as vacant. `anchorFact` names a fact holding
  `"x,y"` in **that file's** projected units (so a district's anchor lives in
  the child asset, a circuit's in the overview); default is the centre of the
  shape's largest sub-path. `labelFact` puts a short label above the block.
- **`records`** are the rows shown when a region is selected. Each carries
  `_region` (the region key) and optionally `_id` (stable React key) and
  `_role: "associate"` for someone who sits beside the bench rather than in it
  (a Circuit Justice). Everything else is opaque, referenced by `display`.

Records for a parent **and its children** travel in the parent's region asset.
Records for top-level regions that have no region asset, and small cross-cutting
sets (who presides over each parent), go in the overview's payload. The pane
merges both.

### `records.display` — mapping fields to the pane

| Key                    | Meaning                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` / `shortTitle` | Full name field; compact label under the avatar.                                                                                                     |
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
`{ field, in?, notIn?, truthy? }` on the record; bake derived booleans into the
records when a condition needs more than one field.

### Validate before uploading

```bash
pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts national.svg --mode drilldown
pnpm tsx .claude/skills/interactive-maps/validate-map-svg.ts circuits/ca8.svg --mode drilldown --overview national.svg --region ca8
```

The overview run reports the hierarchy it infers, the declared regions,
records, seat-block inputs and the facts each region will show, and flags
unlabelled regions, dangling `data-parent-id`s, a rejected payload, records
whose `_region` matches nothing, and display fields no record has. The paired
run additionally reports which shapes will morph and which fall back, and
names the shapes whose vertex counts differ between the two files.

### Configuring the block

Set **Mode** to Drilldown. Upload the overview to Map Assets and pick it as
**Overview SVG**; add one **Region Asset** row per drillable parent with the
parent's path `id` as **Region ID**. **Sources / Attribution** works as in
choropleth mode. Both **Widget Title** and the sources footer are shared.

### What the reader gets

- **Overview**: parent fills, child borders, stroke-only parent outlines, seat
  blocks with labels, hover outline + tooltip (label, summary, facts). Keyboard
  reachable: regions are focusable and Enter/Space selects.
- **Select** (map, block or selector): a pane slides down over the map and
  covers it. Stow (▲) keeps the selection and reveals the map; × or Escape
  closes. The pane shows label, summary, facts, the bench as a **Timeline**
  (commission order, vacancies parked at the end) or a **Seat chart**
  (semicircle over the seat count, first category | vacancies | rest, dotted
  majority line and count, supernumerary Hide/Show/Include), the **Mark**
  toggles, the associate chip, notes, and the sticky docked **detail** panel
  (hover fills it, click pins it).
- **Drill in** ("View districts →"): a vertex morph from the overview
  projection into the child projection (620 ms, commit-rate capped), or zoom +
  crossfade where the invariant fails; the selector repopulates with the
  children and a back control. Child regions select the same way.

### Archivability

The overview is complete in the initial HTML. Each region asset is referenced
as `<link rel="prefetch" href="/map-assets/<file>">` — a stable, same-origin
path (rewritten to the storage bucket in production) that a crawler following
same-origin references will capture — and fetched from that same path on
drill-in. Nothing load-bearing is fetched from a third party; hotlinked photos
are the one exception and degrade to initials. A capture that includes the
prefetched files drills in; one that does not still shows the full overview,
selector, facts and any records carried in the overview payload.

### Troubleshooting (drilldown)

| Symptom                                           | Cause                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Region missing from the selector                  | Its path has no `id`, or its `data-parent-id` names a parent that does not exist (it is then listed at the top level). |
| "View … →" never appears                          | No Region Asset row pinned to that id, and it has no children in the overview.                                         |
| Pane says "No records for this region"            | No record has `_region` equal to that id, or the payload was rejected (run the validator: the error is printed).       |
| Pane shows "Details could not be loaded"          | The region asset URL failed (deleted upload, wrong storage rewrite). Check `/map-assets/<filename>` in the browser.    |
| Drill-in zooms and crossfades instead of morphing | By design when shapes are not absolute `M`/`L` or vertex counts differ. The paired validator run names the shapes.     |
| No seat blocks                                    | No `seats` in the overview payload, or no region carries `totalFact`.                                                  |
| Seat block in the wrong place                     | `anchor` is in the wrong file's units — a child's anchor must be in the child asset's projection.                      |
| Tooltip lists machine facts (`seats-r`, `anchor`) | Add them to `facts.hide`, or reference them from `seats`/`display.seatsFact` so they hide automatically.               |
| Facts show `Active count` instead of your wording | Add `facts.labels`.                                                                                                    |
| Map upside down in the child view only            | The child file lacks the `scale(1,-1)` flip group (or has it while the overview does not); make both consistent.       |
| Photos never appear                               | `display.image.url` names a field the records do not have, or the host blocks hotlinking; initials show instead.       |

## Reference

- Block config and fields — `src/blocks/InteractiveMap/config.ts`
- Sanitizer allowlist — `src/blocks/InteractiveMap/sanitize.ts`
- Parser (id / value / transform extraction) — `src/blocks/InteractiveMap/parseInlineSvg.ts`
- Color scale, breakpoints, bias, formatting — `src/blocks/InteractiveMap/colorScale.ts`
- Map Assets collection — `src/collections/MapAssets/index.ts`
- Drilldown contract and validation — `src/blocks/InteractiveMap/drilldown/types.ts`, `contract.ts`
- Drilldown parsing, regions, morph, seat layout — `src/blocks/InteractiveMap/drilldown/`
- Reference asset pipeline (courts) — `scripts/bake-court-tracker-fixtures.ts`
- Worked examples — `src/endpoints/seed/features/interactive-maps/` (two choropleths with a shared scale; the Federal Courts drilldown)
