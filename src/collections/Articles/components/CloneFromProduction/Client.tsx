"use client"

import {
  Button,
  CheckIcon,
  Drawer,
  PopupList,
  ReactSelect,
  Spinner,
  useConfig,
  useDebounce,
  useModal,
  XIcon,
} from "@payloadcms/ui"
import { useRouter } from "next/navigation"
import React, { useEffect, useState } from "react"

import "./index.scss"

interface ProductionArticle {
  title: string
  slug: string
  publishedAt?: string | null
  existsLocally: boolean
}

interface Option {
  [key: string]: unknown
  label: string
  value: string
  title: string
}

type Outcome = { slug: string; title: string } & (
  | { status: "queued" }
  | { status: "cloning" }
  | { status: "done"; id: number; clonedAs: string }
  | { status: "error"; message: string }
)

const baseClass = "clone-from-production"
const drawerSlug = "clone-from-production"

function optionLabel(article: ProductionArticle): string {
  const date = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ""
  const suffix = article.existsLocally ? " · already here, will clone as a copy" : ""
  return `${article.title}${date ? ` (${date})` : ""}${suffix}`
}

/** Seconds since mount, so a long clone visibly keeps working. */
const Elapsed: React.FC = () => {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return <>{seconds}s</>
}

const ClonePanel: React.FC = () => {
  const {
    config: {
      routes: { admin, api },
    },
  } = useConfig()
  const router = useRouter()

  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  // Which query the current options answer: anything typed since reads as loading, not stale results.
  const [results, setResults] = useState<{ query: string; options: Option[]; error?: string }>()
  const loading = results?.query !== search
  const [selected, setSelected] = useState<Option[]>([])
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const active = outcomes.findIndex((o) => o.status === "cloning")
  const cloning = outcomes.some((o) => o.status === "queued" || o.status === "cloning")

  useEffect(() => {
    const controller = new AbortController()
    const query = debouncedSearch
    fetch(`${api}/articles/production-search?q=${encodeURIComponent(query)}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json()) as { docs?: ProductionArticle[]; error?: string }
        if (!res.ok || !body.docs) throw new Error(body.error ?? `Search failed (${res.status})`)
        setResults({
          query,
          options: body.docs.map((a) => ({ label: optionLabel(a), value: a.slug, title: a.title })),
        })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setResults({ query, options: [], error: err instanceof Error ? err.message : String(err) })
      })
    return () => controller.abort()
  }, [api, debouncedSearch])

  const clone = async () => {
    const queue = selected
    setSelected([])
    setOutcomes(queue.map(({ value, title }) => ({ slug: value, title, status: "queued" })))

    // One request per article keeps each inside the serverless function time limit.
    for (const { value: slug, title } of queue) {
      setOutcomes((prev) =>
        prev.map((o) => (o.slug === slug ? { slug, title, status: "cloning" } : o)),
      )
      let outcome: Outcome
      try {
        const res = await fetch(`${api}/articles/clone-from-production`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        })
        const body = (await res.json()) as {
          id?: number
          slug?: string
          title?: string
          error?: string
        }
        outcome =
          res.ok && body.id !== undefined
            ? {
                slug,
                title: body.title ?? title,
                status: "done",
                id: body.id,
                clonedAs: body.slug ?? slug,
              }
            : { slug, title, status: "error", message: body.error ?? `Failed (${res.status})` }
      } catch (err) {
        outcome = {
          slug,
          title,
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        }
      }
      setOutcomes((prev) => prev.map((o) => (o.slug === slug ? outcome : o)))
    }
    router.refresh()
  }

  return (
    <div className={baseClass}>
      <p className={`${baseClass}__description`}>
        Copies published articles from pragmaticpapers.com into this environment, with their
        authors, topics, media, volume and linked articles.
      </p>
      <div className={`${baseClass}__controls`}>
        <ReactSelect
          className={`${baseClass}__select`}
          isMulti
          isClearable
          isLoading={loading}
          disabled={cloning}
          options={loading ? [] : (results?.options ?? [])}
          value={selected}
          onChange={(value) =>
            setSelected((Array.isArray(value) ? value : [value]) as unknown as Option[])
          }
          onInputChange={setSearch}
          filterOption={() => true}
          placeholder="Search production articles by title…"
          noOptionsMessage={() => results?.error ?? "No matching articles"}
        />
        <Button
          buttonStyle="primary"
          size="medium"
          disabled={!selected.length || cloning}
          onClick={clone}
        >
          {cloning
            ? outcomes.length > 1
              ? `Cloning ${active + 1} of ${outcomes.length}…`
              : "Cloning…"
            : `Clone${selected.length > 1 ? ` ${selected.length} articles` : ""}`}
        </Button>
      </div>
      {outcomes.length > 0 && (
        <ul className={`${baseClass}__outcomes`}>
          {outcomes.map((o) => (
            <li key={o.slug} className={`${baseClass}__outcome ${baseClass}__outcome--${o.status}`}>
              <span className={`${baseClass}__status`}>
                {o.status === "cloning" && <Spinner size="sm" loadingText={null} />}
                {o.status === "done" && <CheckIcon />}
                {o.status === "error" && <XIcon />}
              </span>
              <span className={`${baseClass}__label`} title={o.title}>
                {o.status === "done" ? (
                  <a
                    href={`${admin}/collections/articles/${o.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {o.title}
                  </a>
                ) : (
                  o.title
                )}
              </span>
              {o.status === "cloning" && (
                <span className={`${baseClass}__meta`}>
                  <Elapsed />
                </span>
              )}
              {o.status === "done" && o.clonedAs !== o.slug && (
                <span className={`${baseClass}__meta`}>as {o.clonedAs}</span>
              )}
              {o.status === "error" && <span className={`${baseClass}__meta`}>{o.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const CloneFromProductionMenuItem: React.FC<{ allowed: boolean }> = ({ allowed }) => {
  const { openModal } = useModal()

  if (!allowed) {
    return <PopupList.Button disabled>Clone from production (admins only)</PopupList.Button>
  }

  return (
    <>
      <PopupList.Button onClick={() => openModal(drawerSlug)}>
        Clone from production…
      </PopupList.Button>
      <Drawer slug={drawerSlug} title="Clone from production">
        <ClonePanel />
      </Drawer>
    </>
  )
}
