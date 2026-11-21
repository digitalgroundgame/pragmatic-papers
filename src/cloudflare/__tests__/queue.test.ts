// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"

import ts from "typescript"
import { describe, expect, it } from "vitest"

interface Worker {
  name: string
  preview_urls?: boolean
  vars?: Record<string, string>
  services?: { binding: string; service: string }[]
  durable_objects?: { bindings: { name: string; class_name: string; script_name?: string }[] }
  migrations?: { tag: string; new_sqlite_classes?: string[]; deleted_classes?: string[] }[]
}
type Config = Worker & { env: { production: Worker } }

const read = (file: string): Config => {
  const path = join(process.cwd(), file)
  const { config, error } = ts.parseConfigFileTextToJson(path, readFileSync(path, "utf8"))
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"))
  return config
}

const site = read("wrangler.jsonc")
const queue = read("queue.wrangler.jsonc")
const pairs: [string, Worker, Worker][] = [
  ["staging", site, queue],
  ["production", site.env.production, queue.env.production],
]

describe("the queue Worker", () => {
  it.each(pairs)("holds %s's queue, which the site binds to by name", (_, worker, q) => {
    expect(q.name).toBe(`${worker.name}-queue`)
    expect(worker.durable_objects?.bindings).toEqual([
      { name: "NEXT_CACHE_DO_QUEUE", class_name: "DOQueueHandler", script_name: q.name },
    ])
    expect(q.migrations).toEqual([{ tag: "v1", new_sqlite_classes: ["DOQueueHandler"] }])
  })

  it.each(pairs)("re-renders %s's pages by requesting them from its site", (_, worker, q) => {
    expect(q.services).toEqual([{ binding: "WORKER_SELF_REFERENCE", service: worker.name }])
  })

  it.each(pairs)("leaves %s's site implementing no Durable Object", (_, worker) => {
    const created = new Set<string>()
    for (const step of worker.migrations ?? []) {
      step.new_sqlite_classes?.forEach((name) => created.add(name))
      step.deleted_classes?.forEach((name) => created.delete(name))
    }
    expect([...created]).toEqual([])
  })
})

describe("skew protection's settings", () => {
  it.each(pairs)("give %s's site Version URLs under its own name", (_, worker) => {
    expect(worker.preview_urls).toBe(true)
    expect(worker.vars?.CF_WORKER_NAME).toBe(worker.name)
    expect(worker.vars?.CF_PREVIEW_DOMAIN).toBe("digital-ground-game")
  })
})
