import type { PublicGroup, WhipCountCandidate, WhipCountData } from "./model"

/** A fill as the page's theme names it, and how strongly it is laid on. */
export interface Paint {
  /** A CSS color, usually a theme variable (`var(--chart-3)`). */
  color: string
  opacity: number
}

export const UNASSIGNED: Paint = { color: "var(--border)", opacity: 1 }

/** A light yellow for a position that is against one candidate and for nobody yet. */
export const UNCERTAIN = "#fde68a"

/** The first candidate is drawn in blue, the last in the brand colour. */
export function candidateColor(data: WhipCountData, candidate?: WhipCountCandidate): string {
  if (!candidate) return "var(--muted-foreground)"
  return data.candidates[0]?.id === candidate.id ? "var(--chart-3)" : "var(--brand-fill)"
}

/** How a public position is drawn, on the page and in the downloaded picture. */
export function groupPaint(data: WhipCountData, group: PublicGroup): Paint {
  if (group.stance === "undeclared") return UNASSIGNED
  if (group.stance === "open") return { color: "var(--muted-foreground)", opacity: 0.45 }
  // Ruling one candidate out is a public position, but not a vote for another, so it is not
  // a tint of the other candidate's colour: that is kept for those leaning their way.
  if (group.stance === "opposes") return { color: UNCERTAIN, opacity: 1 }
  return {
    color: candidateColor(data, group.candidate),
    opacity: group.stance === "backs" ? 1 : 0.55,
  }
}
