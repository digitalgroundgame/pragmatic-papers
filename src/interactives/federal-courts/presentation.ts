import ANCHORS from "./geometry/anchors.json"
import type { DrilldownPresentation } from "../types"

/**
 * How the Federal Courts interactive looks. This is Pragmatic Papers' half of the ownership
 * split: every colour, label, order and format lives here, and the feed cannot touch it.
 *
 * Colours are theme tokens so the map follows the site's light and dark palettes; the hex
 * fallbacks are for contexts without the tokens (tests, an archived page).
 */
export const COLORS = {
  Republican: "var(--map-positive-3, #e54858)",
  Democratic: "var(--map-negative-3, #2c86ed)",
  other: "var(--muted-foreground, #9aa3ad)",
} as const

export const federalCourtsPresentation: DrilldownPresentation = {
  facts: {
    // Every fact this feed reports is either the pane's own `heading` (a reserved slot, never
    // a listed fact) or one of the counts below, already said in the region's `summary` line.
    // Nothing is left to label or order.
    hide: [
      // Machine inputs consumed by the seat blocks and the seat chart, never shown as facts.
      "seats",
      "seats-r",
      "seats-o",
      "seats-d",
      "anchor",
      "short-label",
      // The counts are the region's `summary` line ("11 authorized · 10 active · 6 senior ·
      // 1 vacant · Life tenure"), which the pane and tooltip already show; listing them again
      // as facts said everything twice. What remains as facts is what the summary lacks.
      "authorized",
      "active",
      "senior",
      "vacant",
      "tenure",
    ],
  },
  // The Supreme Court is a building everyone knows; a circuit is the scales. Districts get
  // none — the indent under their circuit already says what they are.
  icons: {
    byRegion: { scotus: "landmark" },
    byLayer: { circuit: "scale" },
    // Folded, the rail is a column of numerals: "9th" is drawn IX, the D.C. Circuit keeps its
    // "DC", and the Supreme Court stays the building it already was.
    shortFact: "short-label",
  },
  seats: {
    totalFact: "seats",
    groups: [
      { fact: "seats-r", label: "Republican-appointed", color: COLORS.Republican },
      { fact: "seats-o", label: "Other", color: COLORS.other },
      { fact: "seats-d", label: "Democratic-appointed", color: COLORS.Democratic },
    ],
    vacant: { label: "Vacant" },
    // Checked in beside the geometry they are measured against, and read at render time: an
    // anchor is placement, which is ours, so nudging one is a deploy rather than a re-sync.
    anchors: ANCHORS,
    anchorFact: "anchor",
    labelFact: "short-label",
    // The four courts with no territory. They are read against each other — the Supreme Court
    // over the three specialist courts that feed the Federal Circuit — so the space between
    // them is px, which holds at any width; the group as a whole hangs from the Supreme
    // Court's own anchor in `anchors.json`, like any other block, and is pulled back off the
    // frame's edge if the map has shrunk enough to otherwise push it off.
    clusters: [
      {
        anchor: "scotus",
        rows: [["scotus"], ["cit", "uscfc", "cafc"]],
        gap: 10,
        rowGap: 15,
        align: "right",
      },
    ],
  },
  lookups: {
    // A judge names their appointing president; the president's face is a fact about the
    // president, so the feed carries it once in `datasets.presidents` rather than on every
    // judge they appointed.
    presidents: {
      dataset: "presidents",
      image: "photo_url",
      source: "photo_source",
    },
  },
  display: {
    title: "full_name",
    shortTitle: "display_name",
    image: {
      url: "photo_url",
      source: "photo_source",
      license: "photo_license",
      credit: "photo_credit",
    },
    category: {
      field: "president_party",
      values: [
        {
          value: "Republican",
          label: "Appointed by a Republican president",
          shortLabel: "R-appointed",
          color: COLORS.Republican,
        },
        {
          value: "Democratic",
          label: "Appointed by a Democratic president",
          shortLabel: "D-appointed",
          color: COLORS.Democratic,
        },
      ],
      other: { label: "Other appointment", color: COLORS.other },
    },
    order: "commission_date",
    status: { field: "status", supernumerary: ["senior"], labels: { senior: "Senior" } },
    seatsFact: "seats",
    flags: [{ field: "is_chief", label: "Chief judge", symbol: "★" }],
    cohort: "appointing_president",
    // No marks. The engine can ring a bench by any reported field, and affiliation is the
    // obvious one to ring it by — but upstream has a Federalist Society affiliation on hand
    // for 120 of 1,490 judges and an American Constitution Society one for three. A control
    // that rings three judges reads as "these are the ACS members", when what it means is
    // "these are the three anyone has checked". The same fields still appear on a judge's own
    // card, where they are a claim about that judge and absence claims nothing. Worth
    // restoring when upstream's coverage is worth comparing across a bench.
    details: [
      {
        field: "appointing_president",
        label: "Appointed by",
        format: "portrait",
        lookup: "presidents",
      },
      {
        field: "senior_date",
        format: "date",
        label: "Senior status since",
        when: { field: "status", in: ["senior"] },
      },
      { field: "confirmation_date", format: "date", label: "Confirmed" },
      {
        field: "commission_date",
        format: "term",
        endField: "term_expiration_date",
        label: "Current term",
        when: { field: "shows_term", truthy: true },
      },
      {
        field: "commission_date",
        format: "years-since",
        label: "On the bench",
        when: { field: "shows_term", truthy: false },
      },
      { field: "jd", label: "JD" },
      { field: "aba_rating", label: "ABA rating" },
      {
        field: "fedsoc_reported",
        format: "reported",
        label: "Reported to have a Federalist Society affiliation",
        basisField: "fedsoc_basis",
        sourceField: "fedsoc_source",
      },
      {
        field: "acs_reported",
        format: "reported",
        label: "Reported to have an American Constitution Society affiliation",
        basisField: "acs_basis",
        sourceField: "acs_source",
      },
      { field: "cl_profile_url", format: "link", label: "CourtListener profile" },
    ],
  },
}
