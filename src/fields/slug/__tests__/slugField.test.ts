// @vitest-environment node
import type { FieldHook, RowField, TextField } from "payload"
import { describe, expect, it, vi } from "vitest"

import { keepSlugOnUpdate, slugField } from "../index"

/** The hook this wrapper puts first on the `slug` field. */
function generateHook(row: RowField, name = "slug"): FieldHook {
  const slug = row.fields.find(
    (field): field is TextField => "name" in field && field.name === name,
  )
  const hook = slug?.hooks?.beforeChange?.[0]
  if (!hook) throw new Error(`no beforeChange hook on ${name}`)
  return hook
}

const run = (hook: FieldHook, args: Record<string, unknown>) => hook(args as never)

describe("slugField's generate hook", () => {
  const generate = generateHook(slugField())

  it("slugifies the title on create", async () => {
    expect(await run(generate, { operation: "create", data: { title: "Hello World" } })).toBe(
      "hello-world",
    )
  })

  it("keeps a slug that was given", async () => {
    const args = { operation: "create", data: { title: "Hello World" }, value: "custom" }
    expect(await run(generate, args)).toBe("custom")
  })

  it("leaves the slug empty while there's no title", async () => {
    expect(await run(generate, { operation: "create", data: {} })).toBeUndefined()
  })

  it("fills an empty slug on update while generation is ticked", async () => {
    const args = {
      operation: "update",
      data: { title: "Late Title" },
      siblingData: { generateSlug: true },
    }
    expect(await run(generate, args)).toBe("late-title")
  })

  it("falls back to the saved checkbox when the save doesn't send it", async () => {
    const args = {
      operation: "update",
      data: { title: "Late Title" },
      originalDoc: { generateSlug: true },
    }
    expect(await run(generate, args)).toBe("late-title")
  })

  it("leaves an empty slug alone on update once generation is unticked", async () => {
    const args = {
      operation: "update",
      data: { title: "Late Title" },
      siblingData: { generateSlug: false },
      originalDoc: { generateSlug: true },
    }
    expect(await run(generate, args)).toBeUndefined()
  })

  it("never replaces an existing slug on update", async () => {
    const args = {
      operation: "update",
      data: { title: "Renamed" },
      siblingData: { generateSlug: true },
      value: "original",
    }
    expect(await run(generate, args)).toBe("original")
  })

  it("does nothing on other operations", async () => {
    expect(await run(generate, { operation: "read", data: { title: "Hello" } })).toBeUndefined()
  })

  it("uses a custom source field, checkbox and slugify", async () => {
    const slugify = vi.fn(
      ({ valueToSlugify }: { valueToSlugify?: unknown }) => `vol-${valueToSlugify}`,
    )
    const hook = generateHook(
      slugField({ useAsSlug: "volumeNumber", checkboxName: "auto", slugify }),
    )
    const args = { operation: "update", data: { volumeNumber: 12 }, siblingData: { auto: true } }
    expect(await run(hook, args)).toBe("vol-12")
    expect(slugify).toHaveBeenCalledWith(expect.objectContaining({ valueToSlugify: 12 }))
  })

  it("keeps the slug field's own hooks after it, and applies overrides", () => {
    const own: FieldHook = ({ value }) => value
    const row = slugField({
      overrides: (field) => {
        const slug = field.fields.find((f): f is TextField => "name" in f && f.name === "slug")
        if (slug)
          slug.hooks = { ...slug.hooks, beforeChange: [...(slug.hooks?.beforeChange ?? []), own] }
        return field
      },
    })
    const slug = row.fields.find((f): f is TextField => "name" in f && f.name === "slug")
    expect(slug?.hooks?.beforeChange?.at(-1)).toBe(own)
  })
})

describe("keepSlugOnUpdate", () => {
  // Stands in for Payload's checkbox hook: it assigns the slug before it yields.
  const reslug: FieldHook = async ({ data }) => {
    if (data) data.slug = "from-title"
    await Promise.resolve()
    return true
  }
  const wrapped = keepSlugOnUpdate(reslug, "slug")

  it("puts back the slug the document has when an update re-slugs it", async () => {
    const data: Record<string, unknown> = { title: "Renamed" }
    const result = wrapped({
      operation: "update",
      data,
      originalDoc: { slug: "original" },
    } as never)
    expect(data.slug).toBe("original")
    expect(await result).toBe(true)
  })

  it("keeps a slug the save brought over the document's", () => {
    const data: Record<string, unknown> = { slug: "hand-edited" }
    wrapped({ operation: "update", data, originalDoc: { slug: "original" } } as never)
    expect(data.slug).toBe("hand-edited")
  })

  it("lets an update fill an empty slug", () => {
    const data: Record<string, unknown> = { slug: "" }
    wrapped({ operation: "update", data, originalDoc: { slug: null } } as never)
    expect(data.slug).toBe("from-title")
  })

  it("lets an update that clears the slug have it regenerated", () => {
    const data: Record<string, unknown> = { slug: "" }
    wrapped({ operation: "update", data, originalDoc: { slug: "original" } } as never)
    expect(data.slug).toBe("from-title")
  })

  it("puts the slug back after an async slugify assigns it", async () => {
    const late: FieldHook = async ({ data }) => {
      await Promise.resolve()
      if (data) data.slug = "from-title"
      return true
    }
    const data: Record<string, unknown> = { title: "Renamed" }
    const result = keepSlugOnUpdate(
      late,
      "slug",
    )({
      operation: "update",
      data,
      originalDoc: { slug: "original" },
    } as never)
    expect(await result).toBe(true)
    expect(data.slug).toBe("original")
  })

  it("leaves create to Payload's hook", () => {
    const data: Record<string, unknown> = { slug: "" }
    wrapped({ operation: "create", data } as never)
    expect(data.slug).toBe("from-title")
  })

  it("wraps the checkbox's hook in slugField", () => {
    const row = slugField()
    const checkbox = row.fields.find((f) => "name" in f && f.name === "generateSlug")
    const data: Record<string, unknown> = { title: "Renamed" }
    const hook = checkbox && "hooks" in checkbox ? checkbox.hooks?.beforeChange?.[0] : undefined
    void hook?.({ operation: "update", data, originalDoc: { slug: "original" } } as never)
    expect(data.slug).toBe("original")
  })
})
