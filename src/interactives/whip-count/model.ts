import { isRecord } from "@/utilities/isRecord"
import { failure, success, type Result } from "@/utilities/result"

/**
 * A whip count: who votes in a leadership election, what each has said in public, and the
 * arithmetic of who is ahead. The data is pasted into a `whip-counts` document as JSON, so
 * everything here is checked by `parseWhipCount` before a page reads it. Browser- and
 * Node-safe: the collection validates with it and the page's client component counts with it.
 */

export const WHIP_COUNT_SCHEMA = "pragmatic-papers/whip-count@1"

export const STANCES = ["backs", "leans", "opposes", "open", "undeclared"] as const
/**
 * What a voter has said. `backs`, `leans` and `opposes` name a candidate (for `opposes`, the
 * one they ruled out); `open` is on the record as wanting a change without ruling anyone out.
 */
export type Stance = (typeof STANCES)[number]

export const SEATS = ["continuing", "re-elected", "incoming", "outgoing", "uncalled"] as const
export type Seat = (typeof SEATS)[number]

export interface WhipCountCandidate {
  id: string
  /** Full name, for sentences and legends. */
  name: string
  /** Short name for labels ("Schumer"). */
  short: string
}

export interface WhipCountSource {
  label: string
  url: string
}

export interface WhipCountMember {
  name: string
  state: string
  party: string
  seat: Seat
  /** The ideological bloc an editor files them under, for assigning a group at once. */
  bloc?: string
  stance: Stance
  /** The candidate `stance` is about; absent for `open` and `undeclared`. */
  candidate?: string
  /** The statement behind the stance: a quote or a close paraphrase. */
  basis?: string
  /** The day it was made (YYYY-MM-DD). */
  basisDate?: string
  source?: WhipCountSource
  note?: string
  /**
   * False for someone listed who is not counted as a voter: an uncalled race, or a departing
   * member. Defaults to true, except for an `outgoing` seat, which defaults to false.
   */
  voting: boolean
}

export interface WhipCountData {
  schema: typeof WHIP_COUNT_SCHEMA
  /** The day the count was last checked (YYYY-MM-DD). */
  asOf: string
  /** In the order the page lays them out: the first on the left, the last on the right. */
  candidates: WhipCountCandidate[]
  members: WhipCountMember[]
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

/** The site a link goes to, for a source with no label of its own. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "Source"
  }
}

/**
 * Checks pasted JSON and returns it typed, or the first thing wrong with it in words an
 * editor can act on. Unknown keys are dropped, so nothing a paste carries reaches the page
 * unless it is named here.
 */
export function parseWhipCount(input: unknown): Result<WhipCountData, string> {
  if (!isRecord(input)) return failure("The data must be a JSON object.")
  if (input.schema !== WHIP_COUNT_SCHEMA) {
    return failure(`"schema" must be "${WHIP_COUNT_SCHEMA}".`)
  }
  const asOf = text(input.asOf)
  if (!asOf || !DAY.test(asOf)) return failure('"asOf" must be a date like 2026-11-13.')

  if (!Array.isArray(input.candidates) || input.candidates.length < 2) {
    return failure('"candidates" must list at least two candidates.')
  }
  const candidates: WhipCountCandidate[] = []
  for (const [i, raw] of input.candidates.entries()) {
    const id = isRecord(raw) ? text(raw.id) : undefined
    const name = isRecord(raw) ? text(raw.name) : undefined
    if (!isRecord(raw) || !id || !name) {
      return failure(`Candidate ${i + 1} needs an "id" and a "name".`)
    }
    if (candidates.some((c) => c.id === id)) return failure(`Two candidates share the id "${id}".`)
    candidates.push({ id, name, short: text(raw.short) ?? name })
  }

  if (!Array.isArray(input.members) || input.members.length === 0) {
    return failure('"members" must list the people who vote.')
  }
  const members: WhipCountMember[] = []
  for (const [i, raw] of input.members.entries()) {
    const name = isRecord(raw) ? text(raw.name) : undefined
    if (!isRecord(raw) || !name) return failure(`Member ${i + 1} needs a "name".`)
    if (members.some((m) => m.name === name)) return failure(`"${name}" is listed twice.`)
    const state = text(raw.state)
    if (!state) return failure(`${name} needs a "state".`)
    const seat = SEATS.find((s) => s === raw.seat)
    if (!seat) return failure(`${name}'s "seat" must be one of: ${SEATS.join(", ")}.`)
    const stance = STANCES.find((s) => s === raw.stance)
    if (!stance) return failure(`${name}'s "stance" must be one of: ${STANCES.join(", ")}.`)
    const candidate = text(raw.candidate)
    const named = stance === "backs" || stance === "leans" || stance === "opposes"
    if (named && !candidates.some((c) => c.id === candidate)) {
      return failure(`${name}'s stance "${stance}" needs a "candidate" from the candidates list.`)
    }
    const basisDate = text(raw.basisDate)
    if (basisDate && !DAY.test(basisDate)) {
      return failure(`${name}'s "basisDate" must be a date like 2026-11-13.`)
    }
    let source: WhipCountSource | undefined
    if (raw.source !== undefined && raw.source !== null) {
      const url = isRecord(raw.source) ? text(raw.source.url) : undefined
      // Only https links: the page renders this as an href.
      if (!isRecord(raw.source) || !url || !url.startsWith("https://")) {
        return failure(`${name}'s "source" needs a "url" that starts with https://.`)
      }
      source = { url, label: text(raw.source.label) ?? hostOf(url) }
    }
    members.push({
      name,
      state,
      party: text(raw.party) ?? "",
      seat,
      bloc: text(raw.bloc),
      stance,
      candidate: named ? candidate : undefined,
      basis: text(raw.basis),
      basisDate,
      source,
      note: text(raw.note),
      voting: seat === "outgoing" ? raw.voting === true : raw.voting !== false,
    })
  }
  return success({ schema: WHIP_COUNT_SCHEMA, asOf, candidates, members })
}

/**
 * The same count with departing members counted as voters, or not. Whether they vote depends
 * on the caucus's rules, which aren't always public, so the page lets the reader choose.
 */
export function withOutgoing(data: WhipCountData, counted: boolean): WhipCountData {
  return {
    ...data,
    members: data.members.map((m) => (m.seat === "outgoing" ? { ...m, voting: counted } : m)),
  }
}

export const hasOutgoing = (data: WhipCountData): boolean =>
  data.members.some((m) => m.seat === "outgoing")

/** Votes needed to win: more than half of those voting. */
export const majorityOf = (voters: number): number => Math.floor(voters / 2) + 1

export const votingMembers = (data: WhipCountData): WhipCountMember[] =>
  data.members.filter((m) => m.voting)

/** One group of the public count, in the order the bar draws them. */
export interface PublicGroup {
  key: string
  stance: Stance
  candidate?: WhipCountCandidate
  label: string
  members: WhipCountMember[]
}

export function stanceLabel(stance: Stance, candidate?: WhipCountCandidate): string {
  switch (stance) {
    case "backs":
      return `Backs ${candidate?.short ?? "a candidate"}`
    case "leans":
      return `Leaning ${candidate?.short ?? "a candidate"}`
    case "opposes":
      return `Won’t back ${candidate?.short ?? "a candidate"}`
    case "open":
      return "Open to a change"
    default:
      return "Undeclared"
  }
}

/**
 * Where a stance sits between the first candidate (0) and the last (1): their backers at the
 * ends, leaners next, then those who ruled the other side out, with the undeclared in the
 * middle. Works for two candidates; any others sort between them by their place in the list.
 */
function lean(member: WhipCountMember, data: WhipCountData): number {
  const last = data.candidates.length - 1
  const at = data.candidates.findIndex((c) => c.id === member.candidate)
  const side = at < 0 ? 0.5 : at / last
  const toward = side <= 0.5 ? -1 : 1
  switch (member.stance) {
    case "backs":
      return side
    case "leans":
      return side - toward * 0.1
    case "opposes":
      // Ruling a candidate out moves a voter away from that candidate's end.
      return 0.5 - toward * 0.25
    case "open":
      return 0.52
    default:
      return 0.5
  }
}

/** The voting members grouped by what they have said, ordered from the first candidate's side. */
export function publicGroups(data: WhipCountData): PublicGroup[] {
  const groups = new Map<string, PublicGroup & { at: number }>()
  for (const member of votingMembers(data)) {
    const key = member.candidate ? `${member.stance}:${member.candidate}` : member.stance
    let group = groups.get(key)
    if (!group) {
      const candidate = data.candidates.find((c) => c.id === member.candidate)
      group = {
        key,
        stance: member.stance,
        candidate,
        label: stanceLabel(member.stance, candidate),
        members: [],
        at: lean(member, data),
      }
      groups.set(key, group)
    }
    group.members.push(member)
  }
  return [...groups.values()].sort((a, b) => a.at - b.at).map(({ at: _at, ...group }) => group)
}

/** A reader's own guess: a candidate id for each member they have assigned, by member name. */
export type Draft = Record<string, string>

/** The draft a reader starts from: everyone who has publicly backed a candidate, with them. */
export function startingDraft(data: WhipCountData): Draft {
  const draft: Draft = {}
  for (const member of votingMembers(data)) {
    if (member.stance === "backs" && member.candidate) draft[member.name] = member.candidate
  }
  return draft
}

/** Drops picks for people or candidates the data no longer has (a draft saved before an update). */
export function cleanDraft(draft: unknown, data: WhipCountData): Draft {
  if (!isRecord(draft)) return {}
  const voters = new Set(votingMembers(data).map((m) => m.name))
  const candidates = new Set(data.candidates.map((c) => c.id))
  const clean: Draft = {}
  for (const [name, pick] of Object.entries(draft)) {
    if (voters.has(name) && typeof pick === "string" && candidates.has(pick)) clean[name] = pick
  }
  return clean
}

export interface DraftTally {
  voters: number
  majority: number
  /** Votes per candidate, in the candidates' order. */
  votes: { candidate: WhipCountCandidate; count: number }[]
  unassigned: number
  /** The candidate with a majority, if the draft gives anyone one. */
  winner: WhipCountCandidate | null
}

export function tallyDraft(data: WhipCountData, draft: Draft): DraftTally {
  const voters = votingMembers(data)
  const majority = majorityOf(voters.length)
  const votes = data.candidates.map((candidate) => ({
    candidate,
    count: voters.filter((m) => draft[m.name] === candidate.id).length,
  }))
  const assigned = votes.reduce((sum, v) => sum + v.count, 0)
  return {
    voters: voters.length,
    majority,
    votes,
    unassigned: voters.length - assigned,
    winner: votes.find((v) => v.count >= majority)?.candidate ?? null,
  }
}

/** The blocs in the data, most members first; members without one are left out. */
export function blocsOf(data: WhipCountData): string[] {
  const counts = new Map<string, number>()
  for (const member of votingMembers(data)) {
    if (member.bloc) counts.set(member.bloc, (counts.get(member.bloc) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([b]) => b)
}

/**
 * Gives every member of a bloc to one candidate (or clears them with `null`), except those who
 * have publicly backed someone: a bloc pick is a guess about the uncommitted.
 */
export function assignBloc(
  data: WhipCountData,
  draft: Draft,
  bloc: string,
  candidate: string | null,
): Draft {
  const next = { ...draft }
  for (const member of votingMembers(data)) {
    if (member.bloc !== bloc || member.stance === "backs") continue
    if (candidate) next[member.name] = candidate
    else delete next[member.name]
  }
  return next
}
