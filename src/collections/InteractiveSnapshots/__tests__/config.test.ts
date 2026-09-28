// @vitest-environment node
import type { Field, PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

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
  it("never lets anyone create a snapshot by hand", () => {
    const create = InteractiveSnapshots.access!.create as () => boolean
    expect(create()).toBe(false)
  })

  it("locks every field against updates, so only the sync writes them", () => {
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
