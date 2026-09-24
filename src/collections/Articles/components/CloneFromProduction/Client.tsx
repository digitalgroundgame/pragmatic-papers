"use client"

import { Button, ReactSelect, useConfig, useDebounce } from "@payloadcms/ui"
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
}

type Outcome =
  | { slug: string; status: "cloning" }
  | { slug: string; status: "done"; id: number; clonedAs: string; title: string }
  | { slug: string; status: "error"; message: string }

const baseClass = "clone-from-production"

function optionLabel(article: ProductionArticle): string {
  const date = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ""
  const suffix = article.existsLocally ? " · already here, will clone as a copy" : ""
  return `${article.title}${date ? ` (${date})` : ""}${suffix}`
}

export const CloneFromProductionClient: React.FC = () => {
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
  const cloning = outcomes.some((o) => o.status === "cloning")

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
          options: body.docs.map((a) => ({ label: optionLabel(a), value: a.slug })),
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
    setOutcomes(queue.map(({ value }) => ({ slug: value, status: "cloning" })))

    // One request per article keeps each inside the serverless function time limit.
    for (const { value: slug } of queue) {
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
                status: "done",
                id: body.id,
                clonedAs: body.slug ?? slug,
                title: body.title ?? slug,
              }
            : { slug, status: "error", message: body.error ?? `Failed (${res.status})` }
      } catch (err) {
        outcome = {
          slug,
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
      <h4 className={`${baseClass}__title`}>Clone from production</h4>
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
            ? "Cloning…"
            : `Clone${selected.length > 1 ? ` ${selected.length} articles` : ""}`}
        </Button>
      </div>
      {outcomes.length > 0 && (
        <ul className={`${baseClass}__outcomes`}>
          {outcomes.map((o) => (
            <li key={o.slug} className={`${baseClass}__outcome--${o.status}`}>
              {o.status === "cloning" && `Cloning ${o.slug}…`}
              {o.status === "done" && (
                <>
                  Cloned <a href={`${admin}/collections/articles/${o.id}`}>{o.title}</a>
                  {o.clonedAs !== o.slug && ` as ${o.clonedAs}`}
                </>
              )}
              {o.status === "error" && `${o.slug}: ${o.message}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
