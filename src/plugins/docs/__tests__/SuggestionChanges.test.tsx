import { cleanup, render, screen } from "@testing-library/react"
import type { TextareaFieldClientProps } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

const { useField } = vi.hoisted(() => ({ useField: vi.fn() }))

vi.mock("@payloadcms/ui", () => ({
  useField,
  FieldLabel: ({ label }: { label: string }) => <label>{label}</label>,
}))

import { SuggestionChanges } from "../components/SuggestionChanges"

afterEach(cleanup)

const props = (label?: string) =>
  ({
    path: "changes",
    field: { name: "changes", type: "textarea", label },
  }) as never as TextareaFieldClientProps

describe("SuggestionChanges", () => {
  it("shows the field's diff, under its label", () => {
    useField.mockReturnValue({ value: "@@ -1,1 +1,1 @@\n-Old line\n+New line" })
    render(<SuggestionChanges {...props("Changes to the repo's copy")} />)
    expect(useField).toHaveBeenCalledWith({ path: "changes" })
    expect(screen.getByText("Changes to the repo's copy")).toBeInTheDocument()
    expect(screen.getByText(/New line/)).toHaveClass("doc-diff__line--added")
    expect(screen.getByText(/Old line/)).toHaveClass("doc-diff__line--removed")
  })

  it("says nothing changed when the field is empty", () => {
    useField.mockReturnValue({ value: undefined })
    render(<SuggestionChanges {...props()} />)
    expect(screen.getByText("Changes")).toBeInTheDocument()
    expect(screen.getByText("The doc’s text didn’t change.")).toBeInTheDocument()
  })
})
