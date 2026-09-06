/**
 * The shapes court-tracker publishes under `data/` (see its `docs/CODEBOOK.md`). This is
 * upstream's vocabulary, kept verbatim so a shape change there is a one-file diff here; the
 * adapter is what turns it into ours.
 */

export interface Manifest {
  schema: string
  /** Build hash; folds every input, so it moves whenever their output does. */
  version: string
  generated: string
  last_appointment?: string
  counts?: Record<string, number>
  /**
   * Nation-wide district reconciliation, precomputed upstream (their CODEBOOK Table H) so a
   * consumer does not have to redo it. `authorized + over_authorized === active + vacancies`:
   * a handful of courts seat more active judges than they are authorized, because roving
   * judgeships are shared across districts in the same state.
   */
  national_totals?: {
    authorized: number
    active: number
    vacancies: number
    over_authorized: number
  }
  files: {
    courts: string
    judges: Record<string, string>
    circuit_justices: string
    seat_blocks: string
    judges_search?: string
    district_arrangement?: string
    district_arrangement_alt?: string
    appointments?: string
    president_photos?: string
    geo?: unknown
  }
}

export interface Court {
  court_id: string
  court_name: string
  short_name: string
  court_level: "scotus" | "circuit" | "district" | "specialized"
  parent_id: string | null
  tenure_type: "life_tenured" | "fixed_term" | "fixed_term_senior"
  authorized_judgeships: number | null
  has_geography: boolean
  is_inset: boolean
  geometry_key: string | null
}

export interface SeatBlock {
  level: "circuit" | "district" | "feeder"
  parent_id: string | null
  authorized: number
  total: number
  r: number
  d: number
  o: number
  vacancies: number
  anchor: [number, number] | null
  size: number | null
}

export interface Judge {
  cl_person_id: number | null
  full_name: string
  display_name: string
  court_id: string
  seat_id: string | null
  status: "active" | "senior"
  appointing_president: string | null
  president_party: string | null
  confirmation_date: string | null
  commission_date: string | null
  senior_date: string | null
  term_expiration_date: string | null
  jd_school: string | null
  jd_year: number | null
  aba_rating: string | null
  cl_profile_url: string | null
  photo_url: string | null
  photo_thumb?: string | null
  photo_source: string | null
  photo_license: string | null
  fedsoc_basis: string | null
  fedsoc_source: string | null
  acs_basis: string | null
  acs_source: string | null
  is_chief: boolean
  fedsoc_reported: boolean
  acs_reported: boolean
}

export interface Justice {
  circuit_id: string
  justice_name: string
  full_name: string
  photo_url: string | null
  photo_thumb?: string | null
  photo_source: string | null
  photo_license: string | null
  source_url: string | null
}

export interface PresidentPhoto {
  photo_url: string | null
  photo_thumb?: string | null
  photo_source: string | null
  photo_license: string | null
}

/** One row of the appointments history (every Article III appointment since 1969). */
export interface Appointment {
  full_name: string
  court_id: string
  court_level: string
  appointing_president: string
  president_party: string
  nomination_date: string
  confirmation_date: string
  commission_date: string
  senior_date: string
  termination_date: string
  termination_reason: string
  sitting: string
  fedsoc_reported: string
  acs_reported: string
  photo_thumb: string | null
}

/** The seat-square cartogram layout per circuit, as upstream's builder tool saved it. */
export interface DistrictArrangement {
  schema: string
  circuits: { circuit_id: string; offset: [number, number]; matrix: number[][] }[]
}

/** Everything one sync reads. `judges` is keyed by bundle (circuit id or "scotus"). */
export interface CourtTrackerSources {
  manifest: Manifest
  courts: Court[]
  seatBlocks: Record<string, SeatBlock>
  justices: Justice[]
  judges: Record<string, Judge[]>
  presidents: Record<string, PresidentPhoto> | null
  arrangement: DistrictArrangement | null
  appointments: Appointment[] | null
}
