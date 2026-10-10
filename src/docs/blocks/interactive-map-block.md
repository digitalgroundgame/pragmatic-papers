---
title: Shade a map by value with the Interactive Map block
navTitle: Interactive Map block
summary: Upload a pre-projected SVG to Maps, then show it in an article with each region coloured by its margin, hoverable for the numbers.
publishedAt: 2026-06-15
heroImage: interactive-map-block-hero.webp
heroAlt: An Interactive Map block shading Missouri's congressional districts
audience: [writer, editor]
---

The **Interactive Map** block shows one or more maps whose regions are shaded by a value, like an election margin, with a tooltip on each region. It needs a map drawing first.

## 1. Prepare the SVG

The map has to be an SVG that's already projected (Albers for the US, for example). Before uploading:

- Each region is a single **path** with an **id**, like `CA` or `06037`. A shape without an id is drawn grey and doesn't respond.
- Put the region's display name in `data-label` and its value in an attribute such as `data-margin`.
- Convert shapes, text and symbols to paths. Rectangles, circles, text and images are stripped on upload without warning.
- The root `<svg>` needs a `viewBox`, or the map shows up tiny.

If you're not sure the file is right, ask a developer to run the map checker on it.

## 2. Upload it to Maps

Go to **Maps** (under **Interactives**), upload the SVG, give it a **Label** you'll recognise and, if it came from somewhere, a **Source**. Writers and editors can upload. If you change the file later, upload it again: the old copy doesn't update.

## 3. Add the block

In the article, insert **Interactive Map** and add a row under **Maps** for each map:

- **Pre-projected SVG**: the map you uploaded.
- **Data Attribute**: the attribute holding the values, e.g. `data-margin`. It also sets how numbers read: `data-margin` shows R+5.2 or D+3.1, `data-percent` shows 58.2%.
- **Overrides**: optional rows that set a region's label, value or colour by its **Region ID**, without editing the file. Positive values are R+, negative D+.

For the whole block:

- **Color Scale**: _Diverging Red/Blue_ for margins, or _Per-region custom colors_ to colour regions yourself through overrides.
- **Color Bias**: above 1 makes small margins look stronger; 1 is even.
- **Layout**: side by side or stacked, when there's more than one map. Phones always stack them.
- **Sources / Attribution**: links shown under the maps.

Regions with no value stay neutral. If the whole map comes out grey, the ids or the data attribute probably don't match.
