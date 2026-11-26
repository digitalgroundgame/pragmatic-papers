import { cleanup, fireEvent, render } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { NumberSlugComponent } from "../SlugComponent"

type FormFields = Record<string, { value?: unknown }>

// Mock state the mocked @payloadcms/ui hooks read, reset between tests.
let fieldValue = ""
const setValue = vi.fn((next: string) => {
  fieldValue = next
})
const dispatchFields = vi.fn()
let formFields: FormFields = {}

vi.mock("@payloadcms/ui", () => ({
  useField: () => ({ value: fieldValue, setValue }),
  useForm: () => ({ dispatchFields }),
  useFormFields: (selector: (state: [FormFields]) => unknown) => selector([formFields]),
  FieldLabel: ({ label }: { label?: unknown }) => <span data-testid="label">{String(label)}</span>,
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
  }) => (
    <button data-testid="lock" onClick={onClick} type="button">
      {children}
    </button>
  ),
  TextInput: ({ value, readOnly, path }: { value?: string; readOnly?: boolean; path?: string }) => (
    <input data-testid="slug-input" data-path={path} readOnly={!!readOnly} value={value ?? ""} />
  ),
}))

const baseField = { name: "slug", label: "Slug" }
const props = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    field: baseField,
    fieldToUse: "title",
    checkboxFieldPath: "slugLock",
    path: "slug",
    ...over,
  }) as unknown as Parameters<typeof NumberSlugComponent>[0]

afterEach(() => {
  cleanup()
  fieldValue = ""
  formFields = {}
  setValue.mockClear()
  dispatchFields.mockClear()
})

describe("NumberSlugComponent", () => {
  it("copies the target field into the slug while locked", () => {
    formFields = { slugLock: { value: true }, title: { value: "My Headline" } }
    render(<NumberSlugComponent {...props()} />)
    expect(setValue).toHaveBeenCalledWith("My Headline")
  })

  it("clears the slug when locked and the target is empty", () => {
    fieldValue = "stale"
    formFields = { slugLock: { value: true }, title: { value: "" } }
    render(<NumberSlugComponent {...props()} />)
    expect(setValue).toHaveBeenCalledWith("")
  })

  it("leaves the slug alone when unlocked", () => {
    formFields = { slugLock: { value: false }, title: { value: "Ignored" } }
    render(<NumberSlugComponent {...props()} />)
    expect(setValue).not.toHaveBeenCalled()
  })

  it("does not re-set the slug when it already matches the target", () => {
    fieldValue = "Same"
    formFields = { slugLock: { value: true }, title: { value: "Same" } }
    render(<NumberSlugComponent {...props()} />)
    expect(setValue).not.toHaveBeenCalled()
  })

  it("toggles the lock checkbox on click and prevents default", () => {
    formFields = { slugLock: { value: false }, title: { value: "x" } }
    const { getByTestId } = render(<NumberSlugComponent {...props()} />)
    const prevented = vi.fn()
    fireEvent.click(getByTestId("lock"), { preventDefault: prevented })
    expect(dispatchFields).toHaveBeenCalledWith({
      type: "UPDATE",
      path: "slugLock",
      value: true,
    })
  })

  it("shows Unlock and marks the input read-only while locked", () => {
    formFields = { slugLock: { value: true }, title: { value: "x" } }
    const { getByTestId } = render(<NumberSlugComponent {...props()} />)
    expect(getByTestId("lock")).toHaveTextContent("Unlock")
    expect(getByTestId("slug-input")).toHaveAttribute("readOnly")
  })

  it("shows Lock while unlocked", () => {
    formFields = { slugLock: { value: false }, title: { value: "x" } }
    const { getByTestId } = render(<NumberSlugComponent {...props()} />)
    expect(getByTestId("lock")).toHaveTextContent("Lock")
  })

  it("scopes the checkbox path to the row when the field path is nested", () => {
    formFields = { "meta.slug.slugLock": { value: false }, title: { value: "x" } }
    const { getByTestId } = render(<NumberSlugComponent {...props({ path: "meta.slug" })} />)
    fireEvent.click(getByTestId("lock"))
    expect(dispatchFields).toHaveBeenCalledWith(
      expect.objectContaining({ path: "meta.slug.slugLock" }),
    )
  })

  it("falls back to the field name when no path is given", () => {
    formFields = { slugLock: { value: false }, title: { value: "x" } }
    const { getByTestId } = render(<NumberSlugComponent {...props({ path: undefined })} />)
    expect(getByTestId("slug-input")).toHaveAttribute("data-path", "slug")
    fireEvent.click(getByTestId("lock"))
    expect(dispatchFields).toHaveBeenCalledWith(expect.objectContaining({ path: "slugLock" }))
  })

  it("honors a read-only field even when unlocked", () => {
    formFields = { slugLock: { value: false }, title: { value: "x" } }
    const { getByTestId } = render(<NumberSlugComponent {...props({ readOnly: true })} />)
    expect(getByTestId("slug-input")).toHaveAttribute("readOnly")
  })
})
