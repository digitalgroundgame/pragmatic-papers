import type { PublicGroup, WhipCountCandidate, WhipCountData } from "./model"

/** A fill as the page's theme names it, and how strongly it is laid on. */
export interface Paint {
  /** A CSS color, usually a theme variable (`var(--chart-negative-4)`). */
  color: string
  opacity: number
}

export const UNASSIGNED: Paint = { color: "var(--border)", opacity: 1 }

/**
 * The second candidate's colour: the red the maps use for their strongest R+. Never the brand
 * orange, which would read as the site endorsing them; the count keeps the brand away from it.
 */
export const SECOND_CANDIDATE = "var(--chart-positive-4)"

/** The first candidate's colour: the maps' strongest D+ blue, the data palette's other end. */
export const FIRST_CANDIDATE = "var(--chart-negative-4)"

/** The first candidate is drawn in blue, the second in red, any other in ink. */
export function candidateColor(data: WhipCountData, candidate?: WhipCountCandidate): string {
  if (!candidate) return "var(--muted-foreground)"
  if (data.candidates[0]?.id === candidate.id) return FIRST_CANDIDATE
  return data.candidates[1]?.id === candidate.id ? SECOND_CANDIDATE : "var(--foreground)"
}

/** How a public position is drawn, on the page and in the downloaded picture. */
export function groupPaint(data: WhipCountData, group: PublicGroup): Paint {
  if (group.stance === "undeclared") return UNASSIGNED
  if (group.stance === "open") return { color: "var(--muted-foreground)", opacity: 0.45 }
  // Asked and said nothing: greyer than the open, but a place with a source, unlike the
  // undeclared's empty one.
  if (group.stance === "declined") return { color: "var(--muted-foreground)", opacity: 0.25 }
  // Ruling one candidate out is a public position, but not a vote for another, so it is the
  // theme's amber and not a tint of the other candidate's colour, which is kept for those
  // leaning their way.
  if (group.stance === "opposes") return { color: "var(--warning)", opacity: 1 }
  return {
    color: candidateColor(data, group.candidate),
    opacity: group.stance === "backs" ? 1 : 0.55,
  }
}
