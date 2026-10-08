import { render } from "@testing-library/react"
import type { TextFieldClientProps } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { rememberPickedFile } from "../pickedFiles"
import { UnsplashIdField } from "../UnsplashIdField"

const form = vi.hoisted(() => ({
  value: null as string | null,
  file: undefined as unknown,
  setValue: vi.fn(),
}))

vi.mock("@payloadcms/ui", () => ({
  useField: () => ({ value: form.value, setValue: form.setValue }),
  useFormFields: (select: (ctx: [Record<string, { value: unknown }>]) => unknown) =>
    select([{ file: { value: form.file } }]),
}))

const props = { path: "unsplashId" } as TextFieldClientProps
const picked = new File(["jpeg"], "unsplash-ada-abc123.jpg", {
  type: "image/jpeg",
  lastModified: 1,
})

beforeEach(() => {
  form.value = null
  form.file = undefined
  form.setValue.mockReset()
  rememberPickedFile("abc123", picked)
})

describe("UnsplashIdField", () => {
  it("keeps the id while the picked file is the form's file, renamed or not", () => {
    form.value = "abc123"
    const { container, rerender } = render(<UnsplashIdField {...props} />)
    form.file = picked
    rerender(<UnsplashIdField {...props} />)
    form.file = new File([picked], "renamed.jpg", { type: picked.type, lastModified: 1 })
    rerender(<UnsplashIdField {...props} />)

    expect(form.setValue).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it("clears the id when another file replaces the picked one", () => {
    form.value = "abc123"
    form.file = new File(["something else"], "mine.png", { type: "image/png" })
    render(<UnsplashIdField {...props} />)

    expect(form.setValue).toHaveBeenCalledWith(null)
  })

  it("clears the id when the picked file is removed, but not before it arrives", () => {
    form.value = "abc123"
    const { rerender } = render(<UnsplashIdField {...props} />)
    expect(form.setValue).not.toHaveBeenCalled()

    form.file = picked
    rerender(<UnsplashIdField {...props} />)
    form.file = null
    rerender(<UnsplashIdField {...props} />)

    expect(form.setValue).toHaveBeenCalledWith(null)
  })

  it("leaves a saved photo's id alone when no new file is pending", () => {
    form.value = "saved-id"
    render(<UnsplashIdField {...props} />)
    expect(form.setValue).not.toHaveBeenCalled()
  })
})
