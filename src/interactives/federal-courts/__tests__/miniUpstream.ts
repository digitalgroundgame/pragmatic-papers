import { memoryFileSource, type FileSource } from "../../sources/files"
import { loadFederalCourtsGeometry } from "../geometry"
import type { Court, Judge } from "../upstream"

/**
 * A court-tracker checkout small enough to reason about in a test, yet complete enough to
 * pass the profile's referential checks against the real geometry: one court per drawn
 * region (106 of them, named after their ids), the four non-geographic courts, and whichever
 * judges the test cares about in the 8th Circuit bundle.
 */
export const DEFAULT_JUDGE: Judge = {
  cl_person_id: 1,
  full_name: "Jane Q. Judge",
  display_name: "Judge",
  court_id: "moed",
  seat_id: "MOED01",
  status: "active",
  appointing_president: "Barack Obama",
  president_party: "Democratic",
  confirmation_date: "2014-01-01",
  commission_date: "2014-01-02",
  senior_date: null,
  term_expiration_date: null,
  jd_school: null,
  jd_year: null,
  aba_rating: null,
  cl_profile_url: null,
  photo_url: null,
  photo_source: null,
  photo_license: null,
  fedsoc_basis: null,
  fedsoc_source: null,
  acs_basis: null,
  acs_source: null,
  is_chief: false,
  fedsoc_reported: false,
  acs_reported: false,
}

const court = (over: Partial<Court> & Pick<Court, "court_id">): Court => ({
  court_name: `Court ${over.court_id}`,
  short_name: over.court_id.toUpperCase(),
  court_level: "district",
  parent_id: null,
  tenure_type: "life_tenured",
  authorized_judgeships: 1,
  has_geography: true,
  is_inset: false,
  geometry_key: over.court_id,
  ...over,
})

export async function miniCourtTracker({
  version = "v1",
  judges = [DEFAULT_JUDGE],
  extraCourts = [],
}: {
  version?: string
  judges?: Judge[]
  extraCourts?: Court[]
} = {}): Promise<FileSource> {
  const geometry = await loadFederalCourtsGeometry()
  const drawn: Court[] = geometry.overview.paths
    .filter((p): p is typeof p & { id: string } => p.id !== null)
    .map((p) =>
      court({
        court_id: p.id,
        court_level: p.layer === "circuit" ? "circuit" : "district",
        parent_id: p.parentId,
        is_inset: p.inset,
      }),
    )
  // Real names for the two regions the tests talk about.
  const named: Court[] = drawn.map((c) =>
    c.court_id === "ca8"
      ? {
          ...c,
          court_name: "U.S. Court of Appeals for the Eighth Circuit",
          short_name: "8th Cir.",
          authorized_judgeships: 11,
        }
      : c.court_id === "moed"
        ? {
            ...c,
            court_name: "U.S. District Court for the Eastern District of Missouri",
            short_name: "E.D. Mo.",
            authorized_judgeships: 7,
          }
        : c,
  )
  const nonGeographic: Court[] = [
    court({
      court_id: "scotus",
      court_name: "Supreme Court of the United States",
      short_name: "SCOTUS",
      court_level: "scotus",
      authorized_judgeships: 9,
      has_geography: false,
      geometry_key: null,
    }),
    court({
      court_id: "cafc",
      court_name: "U.S. Court of Appeals for the Federal Circuit",
      short_name: "Fed. Cir.",
      court_level: "circuit",
      authorized_judgeships: 12,
      has_geography: false,
      geometry_key: null,
    }),
    court({
      court_id: "cit",
      court_name: "U.S. Court of International Trade",
      short_name: "CIT",
      court_level: "specialized",
      parent_id: "cafc",
      authorized_judgeships: 9,
      has_geography: false,
      geometry_key: null,
    }),
    court({
      court_id: "uscfc",
      court_name: "U.S. Court of Federal Claims",
      short_name: "CFC",
      court_level: "specialized",
      parent_id: "cafc",
      tenure_type: "fixed_term_senior",
      authorized_judgeships: 16,
      has_geography: false,
      geometry_key: null,
    }),
  ]
  return memoryFileSource({
    "data/manifest.json": {
      schema: "court-tracker/manifest@1",
      version,
      generated: "2026-09-05T11:10:40Z",
      files: {
        courts: "data/courts.json",
        judges: { ca8: "data/judges/ca8.json" },
        circuit_justices: "data/circuit_justices.json",
        seat_blocks: "data/seat_blocks.json",
      },
    },
    "data/courts.json": [...named, ...nonGeographic, ...extraCourts],
    "data/judges/ca8.json": judges,
    "data/circuit_justices.json": [],
    "data/seat_blocks.json": {},
  })
}
