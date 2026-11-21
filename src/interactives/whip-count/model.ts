import { isRecord } from "@/utilities/isRecord"
import { failure, success, type Result } from "@/utilities/result"

/**
 * A whip count: who votes in a leadership election, what each has said in public, and the
 * arithmetic of who is ahead. The data is pasted or pushed into a whip count interactive's
 * snapshot as JSON, so everything here is checked by `parseWhipCount` before a page reads it.
 * Browser- and Node-safe: the snapshot collection validates with it and the page's client
 * component counts with it.
 */

export const WHIP_COUNT_SCHEMA = "pragmatic-papers/whip-count@1"

export const STANCES = ["backs", "leans", "opposes", "open", "declined", "undeclared"] as const
/**
 * What a voter has said. `backs`, `leans` and `opposes` name a candidate (for `opposes`, the
 * one they ruled out); `open` is on the record as wanting a change without ruling anyone out;
 * `declined` was asked and declined to say, where `undeclared` has said nothing we know of.
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
  /**
   * Other groups an editor puts them in, which cut across blocs ("Independent",
   * "Anti-establishment"). A reader can assign any of them at once too.
   */
  tags?: string[]
  stance: Stance
  /** The candidate `stance` is about; absent for `open`, `declined` and `undeclared`. */
  candidate?: string
  /** The statement behind the stance: a quote or a close paraphrase. */
  basis?: string
  /** The day it was made (YYYY-MM-DD). */
  basisDate?: string
  source?: WhipCountSource
  note?: string
  /**
   * False for someone listed who is not counted as a voter, such as an uncalled race.
   * Defaults to true. An outgoing member's is set by the page's "count outgoing" box, which
   * starts unticked.
   */
  voting: boolean
}

/**
 * Something a member said on the record, as the "Latest statements" feed lists it. It names
 * the member and their state itself, so it outlives their row in the count.
 */
export interface WhipCountStatement {
  name: string
  state: string
  /** The day it was said (YYYY-MM-DD). */
  saidOn: string
  /** A quote or a close paraphrase. */
  statement: string
  source?: WhipCountSource
  /**
   * The stance the member held on it, and the candidate it named, when the count knows them:
   * a statement a newer one replaced keeps the stance it stood behind (`memberStatement`).
   * `backedSince` reads them to find when a member's backing began.
   */
  stance?: Stance
  candidate?: string
}

export interface WhipCountUpdates {
  /** Times of day, 24-hour (`"07:37"`). */
  times: string[]
  /** The IANA time zone they are in (`"America/New_York"`). */
  timeZone: string
}

export interface WhipCountData {
  schema: typeof WHIP_COUNT_SCHEMA
  /** The day the count was last checked (YYYY-MM-DD). */
  asOf: string
  /**
   * When the vote is held, as a full timestamp with its offset
   * (`2026-12-01T00:00:00-05:00`). The page counts down to it; without it there is no clock.
   */
  voteAt?: string
  /**
   * When the count is next checked for new statements, as whoever keeps it up to date
   * schedules it: times of day in one time zone. The page shows the next of them.
   */
  updates?: WhipCountUpdates
  /** In the order the page lays them out: the first on the left, the last on the right. */
  candidates: WhipCountCandidate[]
  members: WhipCountMember[]
  /**
   * Earlier statements, newest first: what members said before their latest `basis`, which
   * a push or an editor replaced (`keepReplacedStatements`), and any a push sends on its own.
   * The feed adds each member's latest statement to these (`latestStatements`).
   */
  statements?: WhipCountStatement[]
}

/**
 * Whether a value is meant as a whip count (it names the schema), as against a map's feed
 * in the same snapshot field. Whether it is a valid one is `parseWhipCount`'s question.
 */
export const isWhipCountData = (value: unknown): boolean =>
  isRecord(value) && value.schema === WHIP_COUNT_SCHEMA

const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return true
  } catch {
    return false
  }
}

/** A member's tags: the non-empty strings of a list, once each. Anything else is no tags. */
function tagsOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const tags = [...new Set(value.flatMap((tag) => text(tag) ?? []))]
  return tags.length > 0 ? tags : undefined
}

/** The site a link goes to, for a source with no label of its own. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "Source"
  }
}

/** A source as the data gives it: an https link (the page renders it as an href) and a label. */
function sourceOf(value: unknown): WhipCountSource | null | undefined {
  if (value === undefined || value === null) return undefined
  const url = isRecord(value) ? text(value.url) : undefined
  if (!isRecord(value) || !url || !url.startsWith("https://")) return null
  return { url, label: text(value.label) ?? hostOf(url) }
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

  const voteAt = text(input.voteAt)
  if (voteAt && (!TIMESTAMP.test(voteAt) || Number.isNaN(Date.parse(voteAt)))) {
    return failure('"voteAt" must be a time with its offset, like 2026-12-01T09:30:00-05:00.')
  }

  let updates: WhipCountUpdates | undefined
  if (input.updates !== undefined && input.updates !== null) {
    const times = isRecord(input.updates) ? input.updates.times : undefined
    const timeZone = isRecord(input.updates) ? text(input.updates.timeZone) : undefined
    if (
      !Array.isArray(times) ||
      times.length === 0 ||
      !times.every((time): time is string => typeof time === "string" && TIME.test(time)) ||
      !timeZone ||
      !isTimeZone(timeZone)
    ) {
      return failure(
        '"updates" needs "times" like ["07:37", "16:37"] and a "timeZone" like "America/New_York".',
      )
    }
    updates = { times: [...times].sort(), timeZone }
  }

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
    const source = sourceOf(raw.source)
    if (source === null) {
      return failure(`${name}'s "source" needs a "url" that starts with https://.`)
    }
    members.push({
      name,
      state,
      party: text(raw.party) ?? "",
      seat,
      bloc: text(raw.bloc),
      tags: tagsOf(raw.tags),
      stance,
      candidate: named ? candidate : undefined,
      basis: text(raw.basis),
      basisDate,
      source,
      note: text(raw.note),
      voting: raw.voting !== false,
    })
  }
  let statements: WhipCountStatement[] | undefined
  if (input.statements !== undefined && input.statements !== null) {
    if (!Array.isArray(input.statements)) return failure('"statements" must be a list.')
    statements = []
    for (const [i, raw] of input.statements.entries()) {
      const at = `Statement ${i + 1}`
      if (!isRecord(raw)) return failure(`${at} must be an object.`)
      const name = text(raw.name)
      const state = text(raw.state)
      const statement = text(raw.statement)
      if (!name || !state || !statement) {
        return failure(`${at} needs a "name", a "state" and a "statement".`)
      }
      const saidOn = text(raw.saidOn)
      if (!saidOn || !DAY.test(saidOn)) {
        return failure(`${at} (${name}) needs a "saidOn" date like 2026-11-13.`)
      }
      const source = sourceOf(raw.source)
      if (source === null) {
        return failure(`${at} (${name}) needs a "source" "url" that starts with https://.`)
      }
      let stance: Stance | undefined
      if (raw.stance !== undefined && raw.stance !== null) {
        stance = STANCES.find((s) => s === raw.stance)
        if (!stance) {
          return failure(`${at} (${name}) has a "stance" that isn't one of: ${STANCES.join(", ")}.`)
        }
      }
      const candidate = stance ? text(raw.candidate) : undefined
      statements.push({
        name,
        state,
        saidOn,
        statement,
        source,
        ...(stance ? { stance } : {}),
        ...(candidate ? { candidate } : {}),
      })
    }
    if (statements.length === 0) statements = undefined
  }
  return success({
    schema: WHIP_COUNT_SCHEMA,
    asOf,
    voteAt,
    updates,
    candidates,
    members,
    statements,
  })
}

/** A member's latest statement, when it is dated: the feed lists only dated statements. */
export function memberStatement(member: WhipCountMember): WhipCountStatement | null {
  if (!member.basis || !member.basisDate) return null
  return {
    name: member.name,
    state: member.state,
    saidOn: member.basisDate,
    statement: member.basis,
    source: member.source,
    stance: member.stance,
    ...(member.candidate ? { candidate: member.candidate } : {}),
  }
}

/**
 * The day a member's current stance began: their latest statement's, or the earliest of the
 * unbroken run of earlier statements that held the same stance on the same candidate. A
 * statement whose stance the count doesn't know is skipped, not taken as a break. Undefined
 * when the latest statement isn't dated.
 */
export function backedSince(
  member: WhipCountMember,
  statements: WhipCountStatement[] | undefined,
): string | undefined {
  let since = member.basisDate
  if (!since) return undefined
  const earlier = (statements ?? [])
    .filter((s) => s.name === member.name && s.stance && s.saidOn <= since!)
    .sort((a, b) => b.saidOn.localeCompare(a.saidOn))
  for (const s of earlier) {
    if (s.stance !== member.stance || s.candidate !== member.candidate) break
    since = s.saidOn
  }
  return since
}

/**
 * What makes two statements the same one: who, the day, and the link (or, without one, the
 * words). Rewording a statement under the same link doesn't make it a new one.
 */
const statementKey = (s: WhipCountStatement): string =>
  `${s.name}\n${s.saidOn}\n${s.source?.url ?? s.statement}`

/** The statements once each (the first of any two the same), newest first, stable within a day. */
function newestFirst(statements: WhipCountStatement[]): WhipCountStatement[] {
  const seen = new Set<string>()
  return statements
    .filter((s) => {
      const key = statementKey(s)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((s, at) => ({ s, at }))
    .sort((a, b) => b.s.saidOn.localeCompare(a.s.saidOn) || a.at - b.at)
    .map(({ s }) => s)
}

/**
 * The "Latest statements" feed: each member's latest statement and the earlier ones the
 * count keeps, once each, newest first.
 */
export function latestStatements(data: WhipCountData): WhipCountStatement[] {
  return newestFirst([
    ...data.members.flatMap((m) => memberStatement(m) ?? []),
    ...(data.statements ?? []),
  ])
}

/** The history a count stores: `statements` without anyone's latest, which the feed adds. */
function historyOf(
  members: WhipCountMember[],
  statements: WhipCountStatement[],
): WhipCountStatement[] | undefined {
  const latest = new Set(members.flatMap((m) => memberStatement(m) ?? []).map(statementKey))
  const history = newestFirst(statements).filter((s) => !latest.has(statementKey(s)))
  return history.length > 0 ? history : undefined
}

/** Who replaced a member's statement: a push, which brings what it found, or an editor. */
export type StatementChange = "push" | "editor"

/**
 * Whether `after` is a new statement that replaces `before`, rather than a correction of it.
 * A push reports what members said, so anything it brings under another day or another link
 * (or, without one, in other words) is new: a second statement the same day, or a live page
 * updated the next. An editor more often corrects, so theirs is new only under another day
 * and another link: fixing a date, a link or a typo replaces nothing. Clearing a statement
 * replaces nothing either way.
 */
function replaces(
  after: WhipCountStatement | null,
  before: WhipCountStatement,
  by: StatementChange,
): boolean {
  if (!after) return false
  if (by === "push") return statementKey(after) !== statementKey(before)
  const ref = (s: WhipCountStatement): string => s.source?.url ?? s.statement
  return after.saidOn !== before.saidOn && ref(after) !== ref(before)
}

/**
 * The count `next` with the statements `previous` members had and `next` replaced with newer
 * ones moved into its history, so a newer statement doesn't erase the one before it. A
 * correction isn't kept (`replaces`). Statements already in `next`'s history stay as they
 * are: an editor who removes one there removes it.
 */
export function keepReplacedStatements(
  previous: WhipCountMember[],
  next: WhipCountData,
  by: StatementChange,
): WhipCountData {
  const now = new Map(next.members.map((m) => [m.name, memberStatement(m)]))
  const replaced = previous.flatMap((m) => {
    const before = memberStatement(m)
    return before && replaces(now.get(m.name) ?? null, before, by) ? [before] : []
  })
  const statements = historyOf(next.members, [...(next.statements ?? []), ...replaced])
  const { statements: _statements, ...rest } = next
  return statements ? { ...rest, statements } : rest
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

/**
 * The same count without its blocs, for a page that doesn't show them: each member keeps
 * their tags, so a reader can still assign those groups at once.
 */
export function withoutBlocs(data: WhipCountData): WhipCountData {
  return { ...data, members: data.members.map(({ bloc: _bloc, ...member }) => member) }
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
  /** Toward the first candidate (-1), the second (1), or the middle (0): see `sideOf`. */
  side: -1 | 0 | 1
  /**
   * For those ruling out one of the first two candidates: the side of the line to win they
   * keep to, away from the one they refuse (`right` for those refusing the first).
   */
  pin?: "left" | "right"
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
    case "declined":
      return "Declined to comment"
    default:
      return "Undeclared"
  }
}

/**
 * Which way a stance pulls on the bar: toward the first candidate (-1), toward the second (1),
 * or neither (0). Only backing or leaning to one of the first two candidates has a side.
 * Everything else is undecided and sits in the middle: the undeclared, those who declined to
 * comment (who may still be negotiating, so the bar doesn't read them as leaning), those open
 * to a change, those who ruled a candidate out without naming who they would back, and anyone
 * backing or leaning to a third candidate.
 */
function sideOf(member: WhipCountMember, data: WhipCountData): -1 | 0 | 1 {
  if (member.stance !== "backs" && member.stance !== "leans") return 0
  const at = data.candidates.slice(0, 2).findIndex((c) => c.id === member.candidate)
  return at < 0 ? 0 : at === 0 ? -1 : 1
}

const MIDDLE_ORDER: Stance[] = ["undeclared", "declined", "open", "opposes"]

/**
 * Where a group sits between the first candidate (0) and the second (1): their backers at the
 * ends and leaners next, and the middle (`sideOf`) at 0.5, in `MIDDLE_ORDER`, then any other
 * candidate's groups in the order of the list.
 */
function lean(member: WhipCountMember, data: WhipCountData): number {
  const side = sideOf(member, data)
  if (side === 0) {
    const at = data.candidates.findIndex((c) => c.id === member.candidate)
    const order = MIDDLE_ORDER.indexOf(member.stance)
    return 0.5 + (member.stance === "opposes" || order < 0 ? 4 + at : order) * 0.001
  }
  const end = side === -1 ? 0 : 1
  return member.stance === "backs" ? end : end - side * 0.1
}

/** Which side of the line to win a refusal of one of the first two candidates keeps to. */
function pinOf(member: WhipCountMember, data: WhipCountData): "left" | "right" | undefined {
  if (member.stance !== "opposes") return undefined
  const at = data.candidates.slice(0, 2).findIndex((c) => c.id === member.candidate)
  return at === 0 ? "right" : at === 1 ? "left" : undefined
}

/**
 * The groups as the bar draws them. Each candidate's backers and leaners hold their end, the
 * oldest backing at the very edge and the newest toward the middle (`inBackingOrder`). The
 * undecided sit in the middle, with the undeclared split around them, so many on the left that
 * the line to win falls between those refusing the second candidate and those refusing the
 * first: a refusal always sits on the far side of the line from the candidate it rules out,
 * however the rest of the count moves.
 */
export function barGroups(groups: PublicGroup[]): PublicGroup[] {
  const undeclared = groups.find((g) => g.stance === "undeclared")
  const left = groups.filter((g) => g.side === -1)
  const right = groups.filter((g) => g.side === 1)
  const middle = groups.filter((g) => g.side === 0 && g !== undeclared && !g.pin)
  const pinnedLeft = groups.filter((g) => g.pin === "left")
  const pinnedRight = groups.filter((g) => g.pin === "right")
  const size = (list: PublicGroup[]): number => list.reduce((n, g) => n + g.members.length, 0)
  const line = majorityOf(size(groups))
  const pending = undeclared?.members ?? []
  const before = Math.max(
    0,
    Math.min(pending.length, line - size(left) - size(middle) - size(pinnedLeft)),
  )
  return [
    ...left,
    ...(undeclared ? [{ ...undeclared, members: pending.slice(0, before) }] : []),
    ...middle,
    ...pinnedLeft,
    ...pinnedRight,
    ...(undeclared
      ? [{ ...undeclared, key: `${undeclared.key}:after`, members: pending.slice(before) }]
      : []),
    // Each side runs from its outer edge inward: the second candidate's oldest backing on the right.
    ...right.map((g) => ({ ...g, members: [...g.members].reverse() })),
  ].filter((g) => g.members.length > 0)
}

/**
 * A side's members in the order they came to it: the candidate first, then each by the day
 * their backing began (`backedSince`), oldest first, and anyone without a date last, in the
 * order of the list.
 */
function inBackingOrder(group: PublicGroup, data: WhipCountData): WhipCountMember[] {
  const since = new Map(group.members.map((m) => [m.name, backedSince(m, data.statements)]))
  const rank = (m: WhipCountMember): number => (m.name === group.candidate?.name ? 0 : 1)
  return group.members
    .map((member, at) => ({ member, at }))
    .sort((a, b) => {
      const first = rank(a.member) - rank(b.member)
      if (first) return first
      const x = since.get(a.member.name)
      const y = since.get(b.member.name)
      if (x && y && x !== y) return x.localeCompare(y)
      if (!x !== !y) return x ? -1 : 1
      return a.at - b.at
    })
    .map(({ member }) => member)
}

/**
 * The voting members grouped by what they have said, ordered from the first candidate's side.
 * Within a candidate's groups, members are in the order they came to it (`inBackingOrder`).
 */
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
        side: sideOf(member, data),
        pin: pinOf(member, data),
        at: lean(member, data),
      }
      groups.set(key, group)
    }
    group.members.push(member)
  }
  return [...groups.values()]
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...group }) =>
      group.side === 0 ? group : { ...group, members: inBackingOrder(group, data) },
    )
}

/** What a candidate would have if those who refused their rival hold to it. */
export interface RefusalForecast {
  /** The candidate forecast. */
  candidate: WhipCountCandidate
  /** The candidate they refused. */
  refused: WhipCountCandidate
  /** How many refused them. */
  refusals: number
  /** The candidate's public backers plus those refusals. */
  total: number
}

/**
 * A candidate's forecast if everyone who ruled out their rival follows through. Only with two
 * candidates: with three, refusing one says nothing about which of the others they'd pick.
 * Null when nobody has refused the rival.
 */
export function refusalForecast(
  data: WhipCountData,
  candidate: WhipCountCandidate,
): RefusalForecast | null {
  if (data.candidates.length !== 2) return null
  const refused = data.candidates.find((c) => c.id !== candidate.id)
  if (!refused) return null
  const groups = publicGroups(data)
  const size = (stance: Stance, of: WhipCountCandidate): number =>
    groups.find((g) => g.stance === stance && g.candidate?.id === of.id)?.members.length ?? 0
  const refusals = size("opposes", refused)
  if (refusals === 0) return null
  return { candidate, refused, refusals, total: size("backs", candidate) + refusals }
}

/** How the forecast is made, for a reader who asks. */
export const refusalForecastMethod = ({
  candidate,
  refused,
  refusals,
  total,
}: RefusalForecast): string =>
  `A forecast, not a count: ${candidate.short}’s ${total - refusals} public backers plus the ` +
  `${refusals} who have said they won’t back ${refused.short}. With two candidates, anyone who ` +
  `holds to that and votes can only vote for ${candidate.short}. The ballot is secret, so ` +
  `nobody can check that they do.`

/** The forecast in words: "10 if the 5 who won't back Schumer hold to it". */
export const refusalForecastLine = (forecast: RefusalForecast): string =>
  `${forecast.total} if the ${forecast.refusals} who won’t back ${forecast.refused.short} hold to it`

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

/** A set of voters a reader can assign at once: a bloc, a tag, or a kind of seat. */
export interface MemberGroup {
  kind: "bloc" | "tag" | "seat"
  name: string
  members: WhipCountMember[]
}

const SEAT_GROUPS: Partial<Record<Seat, string>> = {
  incoming: "Incoming senators",
  outgoing: "Outgoing senators",
}

/**
 * The groups among the voting members: blocs first, then tags, then the incoming and the
 * outgoing, each kind with its largest group first.
 */
export function groupsOf(data: WhipCountData): MemberGroup[] {
  const groups = new Map<string, MemberGroup>()
  const add = (kind: MemberGroup["kind"], name: string, member: WhipCountMember): void => {
    const key = `${kind}:${name}`
    const group = groups.get(key) ?? { kind, name, members: [] }
    group.members.push(member)
    groups.set(key, group)
  }
  for (const member of votingMembers(data)) {
    if (member.bloc) add("bloc", member.bloc, member)
    for (const tag of member.tags ?? []) add("tag", tag, member)
    const seat = SEAT_GROUPS[member.seat]
    if (seat) add("seat", seat, member)
  }
  const order = { bloc: 0, tag: 1, seat: 2 }
  return [...groups.values()].sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      b.members.length - a.members.length ||
      a.name.localeCompare(b.name),
  )
}

/**
 * Gives every member of a group to one candidate (or clears them with `null`), except those
 * who have publicly backed someone: a group pick is a guess about the uncommitted.
 */
export function assignGroup(draft: Draft, group: MemberGroup, candidate: string | null): Draft {
  const next = { ...draft }
  for (const member of group.members) {
    if (member.stance === "backs") continue
    if (candidate) next[member.name] = candidate
    else delete next[member.name]
  }
  return next
}

/**
 * A count pushed from outside, laid over the one a document holds. The push owns what was
 * said (positions, statements, sources, the dates) and the roster's facts; the document keeps
 * what its editors decide: each member's bloc and tags, and anyone they added by hand whom
 * the push doesn't know. Statements accumulate: the push's are added to the document's
 * history, and a member's statement the push replaces joins it.
 */
export function mergePushedCount(
  current: WhipCountData | null,
  pushed: WhipCountData,
): WhipCountData {
  if (!current) return pushed
  const held = new Map(current.members.map((m) => [m.name, m]))
  const members = pushed.members.map((member) => {
    const mine = held.get(member.name)
    return mine ? { ...member, bloc: mine.bloc, tags: mine.tags } : member
  })
  const pushedNames = new Set(pushed.members.map((m) => m.name))
  // The push adds to the history and never takes from it: it sends only what's new.
  return keepReplacedStatements(
    current.members,
    {
      ...pushed,
      // A schedule is the document's to keep when the push says nothing of one.
      updates: pushed.updates ?? current.updates,
      members: [...members, ...current.members.filter((m) => !pushedNames.has(m.name))],
      statements: [...(pushed.statements ?? []), ...(current.statements ?? [])],
    },
    "push",
  )
}

/**
 * The next scheduled check after `now`, or null without a schedule. Works out the zone's
 * offset as it is at `now`, so the hour either side of a clock change can be an hour out.
 */
export function nextUpdate(now: Date, updates: WhipCountUpdates | undefined): Date | null {
  if (!updates) return null
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: updates.timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(now)
  const part = (type: string): number => Number(parts.find((p) => p.type === type)?.value)
  // The zone's wall clock read as if it were UTC; its distance from `now` is the offset.
  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  )
  const offset = wall - Math.floor(now.getTime() / 1000) * 1000
  const upcoming = [0, 1]
    .flatMap((day) =>
      updates.times.map((time) => {
        const [hour, minute] = time.split(":").map(Number)
        return Date.UTC(part("year"), part("month") - 1, part("day") + day, hour, minute) - offset
      }),
    )
    .filter((at) => at > now.getTime())
  return upcoming.length > 0 ? new Date(Math.min(...upcoming)) : null
}
