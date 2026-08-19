---
name: interactive-maps
description: Build an Interactive Map for an article — prepare the pre-projected SVG, upload it to Map Assets, and configure the Interactive Map block. Use whenever a writer wants a hoverable/clickable map in a story, or when a map renders blank, all-neutral, or without tooltips. Covers the id-per-path join, the sanitizer allowlist that silently eats most exports, data-attribute values, and the diverging R+/D+ color scale.
---

# Authoring an Interactive Map

The Interactive Map block turns a **pre-projected SVG** into a colored,
hoverable map rendered as real server-side JSX — no map library, no runtime
fetch, no client-side projection. Everything the block knows comes out of the
SVG file plus a handful of block fields.

That makes the SVG a **contract**, and the failure modes are quiet: a file that
breaks the contract renders blank, all-grey, or inert rather than erroring.
Validate before uploading (below) instead of eyeballing the admin preview.

Source of truth is the code in **`src/blocks/InteractiveMap/`** — chiefly
`sanitize.ts` (what survives), `parseInlineSvg.ts` (what is read), and
`colorScale.ts` (how values become colors). This is the checklist.

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

`--scale perRegion` and `--bias <n>` mirror the block's fields.
`.claude/skills/interactive-maps/example-map.svg` is a minimal valid file to
copy from; `src/endpoints/seed/fixtures/mo-districts-119.svg` is a real one.

## Uploading to Map Assets

Interactive-map SVGs go in the **Map Assets** collection (`map-assets`), not
Media. Map Assets skips image processing so the vector data round-trips
intact, and a `beforeValidate` hook copies the file's text into a hidden
`svgContent` field — that captured text is what the block renders, so **a file
edited outside the CMS must be re-uploaded**, not swapped on disk.

- SVG only (`image/svg+xml` is the sole accepted mime type).
- `svgContent` caps at 500,000 characters. A dense export blows past that —
  simplify geometry (QGIS _Simplify_, or `mapshaper -simplify`) rather than
  trimming coordinate precision by hand.
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

## Reference

- Block config and fields — `src/blocks/InteractiveMap/config.ts`
- Sanitizer allowlist — `src/blocks/InteractiveMap/sanitize.ts`
- Parser (id / value / transform extraction) — `src/blocks/InteractiveMap/parseInlineSvg.ts`
- Color scale, breakpoints, bias, formatting — `src/blocks/InteractiveMap/colorScale.ts`
- Map Assets collection — `src/collections/MapAssets/index.ts`
- Worked example (two maps, shared scale) — `src/endpoints/seed/features/interactive-maps/`
