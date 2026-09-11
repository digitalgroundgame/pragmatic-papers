/**
 * A president serving two non-contiguous terms is upstream's one case of the same person
 * appointing under two different strings — Donald Trump's first and second terms arrive as
 * "Donald Trump" and "Donald J. Trump". Collapsed to one canonical string here, at the point
 * every consumer (the cohort ring, the detail line, the parked appointments chart) reads
 * `appointing_president` from, so a cohort groups by the person and not by which term upstream
 * happened to spell out. A standalone module rather than living in `adapter.ts`: both it and
 * `appointments.ts` need this, and `adapter.ts` already imports from `appointments.ts`.
 */
const PRESIDENT_ALIASES: Record<string, string> = {
  "Donald Trump": "Donald J. Trump",
}

export function normalizeAppointingPresident(name: string | null): string | null {
  return name === null ? null : (PRESIDENT_ALIASES[name] ?? name)
}
