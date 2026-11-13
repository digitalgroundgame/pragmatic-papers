"use client"

import React, { useMemo, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatLongDate } from "@/utilities/formatDate"
import { isRecord } from "@/utilities/isRecord"
import { cn } from "@/utilities/utils"

import {
  assignGroup,
  cleanDraft,
  groupsOf,
  hasOutgoing,
  majorityOf,
  publicGroups,
  stanceLabel,
  startingDraft,
  tallyDraft,
  votingMembers,
  withOutgoing,
  type Draft,
  type PublicGroup,
  type WhipCountCandidate,
  type WhipCountData,
} from "./model"

interface Props {
  data: WhipCountData
  /** Names the reader's saved draft in their browser; the document's slug. */
  storageKey: string
}

const storageName = (key: string): string => `whip-count-draft:${key}`

interface StoredDraft {
  /** The candidate the reader chose for a member, by name. */
  picks: Draft
  /** Public backers the reader set back to unassigned. */
  cleared: string[]
}

const CHANGED = "whip-count-draft"
// A browser that refuses storage (private mode, a full quota) keeps the draft for the visit.
const unsaved = new Map<string, string | null>()

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function readStored(key: string): string | null {
  if (unsaved.has(key)) return unsaved.get(key) ?? null
  try {
    return window.localStorage.getItem(storageName(key))
  } catch {
    return null
  }
}

function writeStored(key: string, value: StoredDraft | null): void {
  const text = value ? JSON.stringify(value) : null
  try {
    if (text) window.localStorage.setItem(storageName(key), text)
    else window.localStorage.removeItem(storageName(key))
    unsaved.delete(key)
  } catch {
    unsaved.set(key, text)
  }
  window.dispatchEvent(new Event(CHANGED))
}

/** A saved draft, cleaned of anyone the data no longer lists. An unreadable one is empty. */
function parseStored(text: string | null, data: WhipCountData): StoredDraft {
  try {
    const saved: unknown = JSON.parse(text ?? "null")
    if (isRecord(saved)) {
      return {
        picks: cleanDraft(saved.picks, withOutgoing(data, true)),
        cleared: Array.isArray(saved.cleared)
          ? saved.cleared.filter((name): name is string => typeof name === "string")
          : [],
      }
    }
  } catch {
    // Fall through to an empty draft.
  }
  return { picks: {}, cleared: [] }
}

/** The first candidate is drawn in blue, the last in the brand colour. */
function candidateColor(data: WhipCountData, candidate?: WhipCountCandidate): string {
  if (!candidate) return "var(--muted-foreground)"
  return data.candidates[0]?.id === candidate.id ? "var(--chart-3)" : "var(--brand-fill)"
}

function groupStyle(data: WhipCountData, group: PublicGroup): React.CSSProperties {
  if (group.stance === "undeclared") return { background: "var(--border)" }
  if (group.stance === "open") return { background: "var(--muted-foreground)", opacity: 0.45 }
  // Ruling a candidate out counts toward the other side, drawn fainter than a lean.
  const side =
    group.stance === "opposes"
      ? data.candidates.find((c) => c.id !== group.candidate?.id)
      : group.candidate
  const opacity = group.stance === "backs" ? 1 : group.stance === "leans" ? 0.55 : 0.3
  return { background: candidateColor(data, side), opacity }
}

/** A bar of segments sized by count, with a line where the majority falls. */
function CountBar({
  label,
  segments,
  total,
  majority,
  ends,
}: {
  label: string
  segments: { key: string; count: number; style: React.CSSProperties }[]
  total: number
  majority: number
  /** The candidates at each end of the bar. */
  ends: [string, string]
}): React.ReactNode {
  return (
    <div>
      <div className="relative pt-7" role="img" aria-label={label}>
        <div className="flex h-10 gap-0.5 overflow-hidden rounded-md">
          {segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div key={s.key} style={{ ...s.style, flex: `${s.count} 0 0` }} />
            ))}
        </div>
        <div
          className="border-foreground pointer-events-none absolute top-1 bottom-0 border-l-2"
          style={{ left: `${(majority / total) * 100}%` }}
        >
          <span className="absolute top-0 left-1.5 text-xs font-medium whitespace-nowrap">
            {majority} to win
          </span>
        </div>
      </div>
      <div aria-hidden className="text-muted-foreground mt-1.5 flex justify-between text-xs">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  )
}

/** A headline number with its label, and a line of context under it. */
function Stat({
  value,
  label,
  detail,
  color,
}: {
  value: number
  label: string
  detail?: string
  color?: string
}): React.ReactNode {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <p className="font-display text-4xl leading-none font-bold tabular-nums md:text-5xl">
        {value}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
        {color && (
          <span aria-hidden className="size-2.5 rounded-xs" style={{ background: color }} />
        )}
        {label}
      </p>
      {detail && <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>}
    </div>
  )
}

const eyebrow = "text-brand-text font-serif text-xs font-semibold tracking-widest uppercase"
const sectionTitle = "mt-1 text-2xl md:text-3xl"

/**
 * A whip count: the public count of a leadership vote, and a draft the reader fills in with
 * their own guess of how the uncommitted break, one voter at a time or a bloc at a time. The
 * draft lives in the reader's browser only.
 */
export function WhipCount({ data: published, storageKey }: Props): React.ReactNode {
  const outgoing = hasOutgoing(published)
  const [countOutgoing, setCountOutgoing] = useState(() =>
    published.members.some((m) => m.seat === "outgoing" && m.voting),
  )
  const data = useMemo(() => withOutgoing(published, countOutgoing), [published, countOutgoing])
  const voters = useMemo(() => votingMembers(data), [data])
  const groups = useMemo(() => publicGroups(data), [data])
  // Only groups with someone left to assign: one whose members have all publicly backed a
  // candidate has nothing for a reader to move.
  const memberGroups = useMemo(
    () => groupsOf(data).filter((group) => group.members.some((m) => m.stance !== "backs")),
    [data],
  )
  const majority = majorityOf(voters.length)
  const [first] = data.candidates

  // The reader's own picks, kept in their browser. Public backers they haven't touched come
  // from the data each time, so counting the outgoing brings theirs in too.
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(storageKey),
    () => null,
  )
  const { picks, cleared } = useMemo(() => parseStored(stored, published), [stored, published])
  const draft = useMemo(() => {
    const merged = { ...startingDraft(data), ...cleanDraft(picks, data) }
    for (const name of cleared) if (!picks[name]) delete merged[name]
    return merged
  }, [data, picks, cleared])

  /** Takes the draft as it should now read, and keeps what differs from the starting one. */
  const update = (next: Draft): void => {
    const start = startingDraft(data)
    const nextPicks: Draft = { ...picks }
    const nextCleared = new Set(cleared)
    for (const member of votingMembers(data)) {
      const chosen = next[member.name]
      if (chosen) {
        nextPicks[member.name] = chosen
        nextCleared.delete(member.name)
      } else {
        delete nextPicks[member.name]
        if (start[member.name]) nextCleared.add(member.name)
      }
    }
    writeStored(storageKey, { picks: nextPicks, cleared: [...nextCleared] })
  }
  const pick = (name: string, candidate: string): void => {
    const next = { ...draft }
    if (candidate) next[name] = candidate
    else delete next[name]
    update(next)
  }
  const reset = (): void => writeStored(storageKey, null)

  // The reader's count stays out of the way until they ask for it. One saved from an earlier
  // visit opens by itself; `null` means the reader hasn't said either way on this visit.
  const [opened, setOpened] = useState<boolean | null>(null)
  const drafting = opened ?? stored !== null

  const tally = tallyDraft(data, draft)
  const firmFirst = groups.find((g) => g.stance === "backs" && g.candidate?.id === first?.id)
  const short = Math.max(0, majority - (firmFirst?.members.length ?? 0))

  const draftSegments = [
    ...tally.votes.slice(0, 1).map((v) => ({
      key: v.candidate.id,
      count: v.count,
      style: { background: candidateColor(data, v.candidate) },
    })),
    { key: "unassigned", count: tally.unassigned, style: { background: "var(--border)" } },
    ...tally.votes
      .slice(1)
      .reverse()
      .map((v) => ({
        key: v.candidate.id,
        count: v.count,
        style: { background: candidateColor(data, v.candidate) },
      })),
  ]

  const count = (stance: "backs" | "leans", candidate: WhipCountCandidate): number =>
    groups.find((g) => g.stance === stance && g.candidate?.id === candidate.id)?.members.length ?? 0
  const committed = data.candidates.reduce((sum, c) => sum + count("backs", c), 0)
  const ends: [string, string] = [first?.short ?? "", data.candidates.at(-1)?.short ?? ""]

  return (
    <div data-whip-count="" className="flex flex-col gap-12">
      <section aria-labelledby="whip-count-public">
        <p className={eyebrow}>As of {formatLongDate(`${data.asOf}T00:00:00Z`)}</p>
        <h2 id="whip-count-public" className={sectionTitle}>
          The public count
        </h2>
        <p className="text-muted-foreground mt-3 max-w-3xl">
          {voters.length} vote, so {majority} wins.
          {first && firmFirst
            ? ` ${firmFirst.members.length} have publicly backed ${first.name}, ${short} short of a majority.`
            : ""}{" "}
          The ballot is secret: these are public statements, not votes.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {data.candidates.map((c) => (
            <Stat
              key={c.id}
              value={count("backs", c)}
              label={`Back ${c.short}`}
              detail={count("leans", c) > 0 ? `plus ${count("leans", c)} leaning` : "publicly"}
              color={candidateColor(data, c)}
            />
          ))}
          <Stat
            value={voters.length - committed}
            label="Uncommitted"
            detail="have backed nobody in public"
          />
          <Stat value={majority} label="To win" detail={`of ${voters.length} votes`} />
        </div>

        <div className="mt-6">
          <CountBar
            label={`${groups.map((g) => `${g.label}: ${g.members.length}`).join(", ")}. ${majority} of ${voters.length} needed to win.`}
            segments={groups.map((g) => ({
              key: g.key,
              count: g.members.length,
              style: groupStyle(data, g),
            }))}
            total={voters.length}
            majority={majority}
            ends={ends}
          />
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {groups.map((g) => (
              <li key={g.key} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-xs" style={groupStyle(data, g)} />
                <span className="font-medium tabular-nums">{g.members.length}</span>
                <span className="text-muted-foreground">{g.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {outgoing && (
          <label className="mt-5 flex w-fit items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-foreground size-4"
              checked={countOutgoing}
              onChange={(event) => setCountOutgoing(event.target.checked)}
            />
            Count outgoing senators as voters
          </label>
        )}
      </section>

      {drafting ? (
        <section
          aria-labelledby="whip-count-draft"
          className="border-border bg-card rounded-lg border p-5 md:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={eyebrow}>Your guess</p>
              <h2 id="whip-count-draft" className={sectionTitle}>
                Your count
              </h2>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reset}>
                Start over
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpened(false)}>
                Hide
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 max-w-3xl text-sm">
            Everyone who has publicly backed a candidate starts with them. Assign the rest a group
            at a time here, or one by one in the table below. Your count is saved in this browser
            only.
          </p>

          <div className="mt-5">
            <CountBar
              label={`Your count: ${tally.votes.map((v) => `${v.candidate.short} ${v.count}`).join(", ")}, unassigned ${tally.unassigned}. ${majority} needed to win.`}
              segments={draftSegments}
              total={tally.voters}
              majority={majority}
              ends={ends}
            />
          </div>
          <p
            className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"
            aria-live="polite"
            data-whip-count-result=""
          >
            {tally.votes.map((v) => (
              <span key={v.candidate.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-xs"
                  style={{ background: candidateColor(data, v.candidate) }}
                />
                <span className="font-medium tabular-nums">{v.count}</span> {v.candidate.short}
              </span>
            ))}
            <span className="text-muted-foreground">
              <span className="font-medium tabular-nums">{tally.unassigned}</span> unassigned
            </span>
            <strong className="basis-full text-base sm:basis-auto">
              {tally.winner
                ? `${tally.winner.name} wins in your count.`
                : "Nobody has a majority in your count yet."}
            </strong>
          </p>

          {memberGroups.length > 0 && (
            <div className="border-border mt-6 border-t pt-5">
              <h3 className="font-sans text-sm leading-normal font-semibold tracking-normal">
                Assign a group
              </h3>
              <p className="text-muted-foreground text-xs">
                Moves everyone in the group who has not publicly backed a candidate.
              </p>
              <ul className="mt-3 grid gap-x-8 gap-y-2.5 lg:grid-cols-2">
                {memberGroups.map((group) => {
                  const open = group.members.filter((m) => m.stance !== "backs")
                  return (
                    <li
                      key={`${group.kind}:${group.name}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{group.name}</span>{" "}
                        <span className="text-muted-foreground">({open.length} uncommitted)</span>
                      </span>
                      <span className="flex gap-1.5">
                        {data.candidates.map((c) => (
                          <Button
                            key={c.id}
                            size="sm"
                            variant="outline"
                            disabled={open.length === 0}
                            aria-label={`Give ${group.name} to ${c.short}`}
                            onClick={() => update(assignGroup(draft, group, c.id))}
                          >
                            {c.short}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={open.length === 0}
                          aria-label={`Clear ${group.name}`}
                          onClick={() => update(assignGroup(draft, group, null))}
                        >
                          Clear
                        </Button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section
          aria-labelledby="whip-count-draft"
          className="border-border bg-card flex flex-wrap items-center justify-between gap-4 rounded-lg border p-5 md:p-6"
        >
          <div>
            <h2 id="whip-count-draft" className="text-2xl">
              Think you know how it breaks?
            </h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Assign the uncommitted yourself, one senator or one bloc at a time, and see who wins.
            </p>
          </div>
          <Button variant="branded" onClick={() => setOpened(true)}>
            Make your own count
          </Button>
        </section>
      )}

      <section aria-labelledby="whip-count-members">
        <p className={eyebrow}>{voters.length} votes</p>
        <h2 id="whip-count-members" className={sectionTitle}>
          Every vote
        </h2>
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {drafting && <TableHead>Your pick</TableHead>}
              <TableHead>Public position</TableHead>
              <TableHead>Bloc</TableHead>
              <TableHead>What they said</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.flatMap((g) =>
              g.members.map((m) => (
                <TableRow key={m.name}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {m.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({[m.party, m.state].filter(Boolean).join("-")})
                    </span>
                    {(m.seat === "incoming" || m.seat === "outgoing") && (
                      <span className="text-muted-foreground block text-xs font-normal">
                        {m.seat === "incoming" ? "Incoming" : "Outgoing"}
                      </span>
                    )}
                  </TableCell>
                  {drafting && (
                    <TableCell>
                      <select
                        aria-label={`Your pick for ${m.name}`}
                        value={draft[m.name] ?? ""}
                        onChange={(event) => pick(m.name, event.target.value)}
                        className={cn(
                          "border-input bg-background h-8 rounded-sm border px-2 text-sm",
                          !draft[m.name] && "text-muted-foreground",
                        )}
                      >
                        <option value="">Unassigned</option>
                        {data.candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.short}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block size-2.5 rounded-xs"
                      style={groupStyle(data, g)}
                    />
                    {stanceLabel(m.stance, g.candidate)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.bloc ?? "—"}
                    {m.tags && (
                      <span className="text-muted-foreground block text-xs">
                        {m.tags.join(", ")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-64 whitespace-normal">
                    {/* Long quotes are cut to three lines on a phone, where the row would
                        otherwise run to a screen's height. */}
                    <span className="line-clamp-3 sm:line-clamp-none">
                      {m.basis ?? (
                        <span className="text-muted-foreground">No public statement found</span>
                      )}
                    </span>
                    {m.note && <span className="text-muted-foreground block">{m.note}</span>}
                    {m.source && (
                      <span className="text-muted-foreground block text-xs">
                        {m.basisDate ? `${formatLongDate(`${m.basisDate}T00:00:00Z`)} · ` : ""}
                        <a href={m.source.url} rel="noopener" className="underline">
                          {m.source.label}
                        </a>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
