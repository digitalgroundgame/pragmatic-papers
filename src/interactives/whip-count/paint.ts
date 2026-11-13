import type { PublicGroup, WhipCountCandidate, WhipCountData } from "./model"

/** A fill as the page's theme names it, and how strongly it is laid on. */
export interface Paint {
  /** A CSS color, usually a theme variable (`var(--chart-3)`). */
  color: string
  opacity: number
  /** A fill pale enough to need a hairline round it to show on the page's background. */
  outlined?: boolean
}

/** A step darker than the theme's border grey, to stand apart from the pale yellow. */
export const UNASSIGNED: Paint = { color: "var(--muted-foreground)", opacity: 0.28 }

/** The first candidate is drawn in blue, the last in the brand colour. */
export function candidateColor(data: WhipCountData, candidate?: WhipCountCandidate): string {
  if (!candidate) return "var(--muted-foreground)"
  return data.candidates[0]?.id === candidate.id ? "var(--chart-3)" : "var(--brand-fill)"
}

/** How a public position is drawn, on the page and in the downloaded picture. */
export function groupPaint(data: WhipCountData, group: PublicGroup): Paint {
  if (group.stance === "undeclared") return UNASSIGNED
  if (group.stance === "open") return { color: "var(--muted-foreground)", opacity: 0.6 }
  // Ruling one candidate out is a public position, but not a vote for another: the pale
  // yellow the maps use for neutral, which is neither candidate's colour.
  if (group.stance === "opposes") {
    return { color: "var(--map-neutral)", opacity: 1, outlined: true }
  }
  return {
    color: candidateColor(data, group.candidate),
    opacity: group.stance === "backs" ? 1 : 0.55,
  }
}
