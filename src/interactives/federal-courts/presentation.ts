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
    labels: {
      "full-name": "Court",
      tenure: "Tenure",
      authorized: "Authorized judgeships",
      active: "Active judges",
      senior: "Senior judges",
      vacant: "Vacancies",
    },
    order: ["full-name", "tenure", "authorized", "active", "senior", "vacant"],
    hide: [
      // Machine inputs consumed by the seat blocks and the seat chart, never shown as facts.
      "seats",
      "seats-r",
      "seats-o",
      "seats-d",
      "anchor",
      "short-label",
      "photo-thumb",
      // The counts are the region's `summary` line ("11 authorized · 11 active · 6 senior ·
      // 0 vacant"), which the pane and tooltip already show; listing them again as facts
      // said everything twice. What remains as facts is what the summary lacks.
      "authorized",
      "active",
      "senior",
      "vacant",
    ],
  },
  seats: {
    totalFact: "seats",
    groups: [
      { fact: "seats-r", label: "Republican-appointed", color: COLORS.Republican },
      { fact: "seats-o", label: "Other", color: COLORS.other },
      { fact: "seats-d", label: "Democratic-appointed", color: COLORS.Democratic },
    ],
    vacant: { label: "Vacant" },
    anchorFact: "anchor",
    labelFact: "short-label",
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
    marks: [
      { field: "fedsoc_reported", label: "FedSoc" },
      { field: "acs_reported", label: "ACS" },
    ],
    details: [
      { field: "appointing_president", label: "Appointed by" },
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
