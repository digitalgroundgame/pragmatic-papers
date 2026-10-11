"use client"

import React, { useState } from "react"

import type {
  UnsplashOrientation,
  UnsplashPhoto,
  UnsplashSearchPage,
} from "@/integrations/unsplash"

import "./UnsplashSearch.css"

export type UnsplashResults = UnsplashSearchPage & { homeUrl: string }

/** One page of results; rejects with the message to show. */
export type SearchUnsplash = (
  query: string,
  page: number,
  orientation: UnsplashOrientation | "",
) => Promise<UnsplashResults>

/**
 * Brings the photo into the upload form, with Unsplash's home page for its credit; rejects
 * with the message to show.
 */
export type PickUnsplashPhoto = (photo: UnsplashPhoto, homeUrl: string) => Promise<void>

const baseClass = "unsplash-search"

const ORIENTATIONS: Array<[UnsplashOrientation | "", string]> = [
  ["", "Any shape"],
  ["landscape", "Landscape"],
  ["portrait", "Portrait"],
  ["squarish", "Square"],
]

type State =
  | { step: "idle" }
  | { step: "searching" }
  | { step: "failed"; message: string }
  | { step: "done"; query: string; page: number; results: UnsplashResults }

/**
 * Search Unsplash and pick a photo. Each result credits its photographer and links to
 * Unsplash, as their guidelines ask wherever their photos are shown; thumbnails are
 * Unsplash's own URLs (hotlinked, never copied) until one is picked.
 */
export function UnsplashSearch({
  search,
  onPick,
}: {
  search: SearchUnsplash
  onPick: PickUnsplashPhoto
}): React.ReactNode {
  const [query, setQuery] = useState("")
  const [orientation, setOrientation] = useState<UnsplashOrientation | "">("")
  const [state, setState] = useState<State>({ step: "idle" })
  const [loadingMore, setLoadingMore] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  const run = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    // React events bubble through the drawer's portal to the document's own form, which
    // would take this submit as a save.
    event.stopPropagation()
    const q = query.trim()
    if (!q) return
    setState({ step: "searching" })
    setPickError(null)
    try {
      setState({ step: "done", query: q, page: 1, results: await search(q, 1, orientation) })
    } catch (err) {
      setState({ step: "failed", message: err instanceof Error ? err.message : String(err) })
    }
  }

  const more = async (): Promise<void> => {
    if (state.step !== "done") return
    setLoadingMore(true)
    try {
      const next = await search(state.query, state.page + 1, orientation)
      setState({
        ...state,
        page: state.page + 1,
        results: { ...next, results: [...state.results.results, ...next.results] },
      })
    } catch (err) {
      setPickError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingMore(false)
    }
  }

  const pick = async (photo: UnsplashPhoto, homeUrl: string): Promise<void> => {
    setPicking(photo.id)
    setPickError(null)
    try {
      await onPick(photo, homeUrl)
    } catch (err) {
      setPickError(err instanceof Error ? err.message : String(err))
    } finally {
      setPicking(null)
    }
  }

  return (
    <div className={baseClass}>
      <form className={`${baseClass}__form`} onSubmit={run} role="search">
        <input
          aria-label="Search Unsplash"
          className={`${baseClass}__query`}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search free photos"
          type="search"
          value={query}
        />
        <select
          aria-label="Shape"
          className={`${baseClass}__orientation`}
          onChange={(e) => setOrientation(e.target.value as UnsplashOrientation | "")}
          value={orientation}
        >
          {ORIENTATIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          className={`${baseClass}__button`}
          disabled={state.step === "searching"}
          type="submit"
        >
          {state.step === "searching" ? "Searching…" : "Search"}
        </button>
      </form>

      {state.step === "failed" && (
        <p className={`${baseClass}__error`} role="alert">
          {state.message}
        </p>
      )}
      {pickError && (
        <p className={`${baseClass}__error`} role="alert">
          {pickError}
        </p>
      )}

      {state.step === "done" && state.results.rateLimit && (
        <p className={`${baseClass}__note`}>
          {state.results.rateLimit.remaining} of {state.results.rateLimit.limit} Unsplash requests
          left this hour. Each search, pick and save uses one or two.
        </p>
      )}

      {state.step === "done" && state.results.results.length === 0 && (
        <p className={`${baseClass}__note`}>No photos match “{state.query}”.</p>
      )}

      {state.step === "done" && state.results.results.length > 0 && (
        <>
          <ul className={`${baseClass}__grid`}>
            {state.results.results.map((photo) => (
              <li className={`${baseClass}__item`} key={photo.id}>
                <button
                  aria-label={`Use ${photo.alt ?? "this photo"} by ${photo.photographer.name}`}
                  className={`${baseClass}__photo`}
                  disabled={picking != null}
                  onClick={() => void pick(photo, state.results.homeUrl)}
                  style={{
                    aspectRatio: `${photo.width} / ${photo.height}`,
                    background: photo.color ?? undefined,
                  }}
                  type="button"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash requires hotlinking their URL */}
                  <img alt="" loading="lazy" src={photo.thumbUrl} />
                  {picking === photo.id && <span className={`${baseClass}__picking`}>Adding…</span>}
                </button>
                <span className={`${baseClass}__credit`}>
                  <a href={photo.photographer.profileUrl} rel="noopener noreferrer" target="_blank">
                    {photo.photographer.name}
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <div className={`${baseClass}__footer`}>
            <span className={`${baseClass}__note`}>
              Photos from{" "}
              <a href={state.results.homeUrl} rel="noopener noreferrer" target="_blank">
                Unsplash
              </a>
              . Picking one credits its photographer in the caption.
            </span>
            {state.page < state.results.totalPages && (
              <button
                className={`${baseClass}__button`}
                disabled={loadingMore}
                onClick={() => void more()}
                type="button"
              >
                {loadingMore ? "Loading…" : "More photos"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
