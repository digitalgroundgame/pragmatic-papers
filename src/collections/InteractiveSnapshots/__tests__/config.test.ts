// @vitest-environment node
import type { Field, PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"
import { whipCountData } from "@/stories/fixtures/whipCount"

import { InteractiveSnapshots } from "../index"

const editor = { id: 1, roles: ["editor"] } as unknown as User
const writer = { id: 2, roles: ["writer"] } as unknown as User

/** Every named field, however deeply it sits in rows, groups or tabs. */
function namedFields(fields: Field[]): Extract<Field, { name: string }>[] {
  return fields.flatMap((field): Extract<Field, { name: string }>[] => {
    const nested =
      "fields" in field && Array.isArray(field.fields)
        ? namedFields(field.fields)
        : "tabs" in field
          ? field.tabs.flatMap((tab) => namedFields(tab.fields))
          : []
    return "name" in field ? [field, ...nested] : nested
  })
}

describe("InteractiveSnapshots access", () => {
  const feed = { schema: "pragmatic-papers/drilldown-data@1", regions: [], records: [] }

  it("lets only an editor create one, and only with a whip count", () => {
    const create = InteractiveSnapshots.access!.create as (args: unknown) => boolean
    const as = (user: User | null, data: unknown) => create({ req: { user }, data: { data } })
    expect(as(editor, whipCountData)).toBe(true)
    expect(as(writer, whipCountData)).toBe(false)
    expect(as(null, whipCountData)).toBe(false)
    // A map's feed comes from the sync, never by hand.
    expect(as(editor, feed)).toBe(false)
    expect(as(editor, undefined)).toBe(false)
  })

  it("lets editors change a whip count's data, and nothing else", () => {
    const fields = namedFields(InteractiveSnapshots.fields)
    const data = fields.find((field) => field.name === "data")!
    const update = (data as { access: { update: (args: unknown) => boolean } }).access.update
    expect(update({ req: { user: editor }, doc: { data: whipCountData } })).toBe(true)
    expect(update({ req: { user: writer }, doc: { data: whipCountData } })).toBe(false)
    expect(update({ req: { user: editor }, doc: { data: feed } })).toBe(false)
  })

  it("locks every other field against updates, so only the sync and pushes write them", () => {
    const fields = namedFields(InteractiveSnapshots.fields)
    expect(fields.length).toBeGreaterThan(0)
    for (const field of fields) {
      const update = "access" in field ? field.access?.update : undefined
      expect(update, `${field.name} has no update access rule`).toBeTypeOf("function")
      expect(
        (update as (args: unknown) => boolean)({ req: { user: editor } }),
        `${field.name} can be updated`,
      ).toBe(false)
    }
  })
})

describe("InteractiveSnapshots data", () => {
  const data = namedFields(InteractiveSnapshots.fields).find((field) => field.name === "data")!
  const validate = (
    data as unknown as {
      validate: (value: unknown, opts: { previousValue?: unknown }) => true | string
    }
  ).validate
  const stamp = InteractiveSnapshots.hooks!.beforeChange![0] as unknown as (args: {
    data: Record<string, unknown>
  }) => Record<string, unknown>

  it("checks a whip count like the page reads it", () => {
    expect(validate(whipCountData, {})).toBe(true)
    expect(validate({ ...whipCountData, asOf: "today" }, {})).toBe(
      '"asOf" must be a date like 2026-11-13.',
    )
  })

  it("won't turn a whip count into something else, and leaves a feed to the sync", () => {
    expect(validate({ schema: "other" }, { previousValue: whipCountData })).toBe(
      '"schema" must be "pragmatic-papers/whip-count@1".',
    )
    expect(validate({ schema: "pragmatic-papers/drilldown-data@1" }, {})).toBe(true)
  })

  it("restamps a whip count's provenance when it changes, and leaves a feed's alone", () => {
    const stamped = stamp({ data: { data: { ...whipCountData, asOf: "2026-11-14" } } })
    expect(stamped).toMatchObject({ sourceVersion: "2026-11-14" })
    expect(stamped.contentHash).toMatch(/^[0-9a-f]{16}$/)
    expect(stamped.summary).toContain("as of 2026-11-14")
    const feedData = { data: { schema: "pragmatic-papers/drilldown-data@1" }, summary: "x" }
    expect(stamp({ data: feedData })).toBe(feedData)
  })
})

describe("POST /api/interactive-snapshots/sync", () => {
  const endpoint = InteractiveSnapshots.endpoints
    ? InteractiveSnapshots.endpoints.find((e) => e.path === "/sync")
    : undefined
  const queue = vi.fn()
  const run = vi.fn()

  const call = (user: User | null, query = ""): Promise<Response> =>
    endpoint!.handler({
      user,
      url: `http://localhost/api/interactive-snapshots/sync${query}`,
      payload: { jobs: { queue, run } },
    } as unknown as PayloadRequest) as Promise<Response>

  beforeEach(() => {
    vi.clearAllMocks()
    queue.mockResolvedValue({ id: 42 })
    run.mockResolvedValue({ jobStatus: { 42: { status: "success" } } })
  })

  it("is a POST endpoint", () => {
    expect(endpoint?.method).toBe("post")
  })

  it.each([
    ["anonymous", null],
    ["a writer", writer],
  ])("refuses %s without queueing anything", async (_label, user) => {
    const res = await call(user)
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" })
    expect(queue).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it("queues a sync of every interactive and runs it", async () => {
    const res = await call(editor)
    expect(queue).toHaveBeenCalledWith({ task: "syncInteractiveData", input: { force: false } })
    expect(run).toHaveBeenCalledWith({ queue: "default", limit: 1 })
    await expect(res.json()).resolves.toEqual({
      jobId: 42,
      result: { jobStatus: { 42: { status: "success" } } },
    })
  })

  it("narrows to one interactive and forces a re-read when asked", async () => {
    await call(editor, "?interactive=7&force=true")
    expect(queue).toHaveBeenCalledWith({
      task: "syncInteractiveData",
      input: { interactiveId: 7, force: true },
    })
  })

  it("only forces on an explicit force=true", async () => {
    await call(editor, "?force=1")
    expect(queue).toHaveBeenCalledWith({ task: "syncInteractiveData", input: { force: false } })
  })
})
