import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

type MockFields = Record<string, { value?: unknown } | undefined>
let mockFields: MockFields = {}

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

vi.mock("@payloadcms/ui", () => ({
  Button: ({ children, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick}>{children}</button>
  ),
  FieldLabel: ({ label }: { label: string }) => <label>{label}</label>,
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
  useFormFields: <T,>(selector: (args: [MockFields, unknown]) => T): T =>
    selector([mockFields, vi.fn()]),
}))

import { SubstackImportUrl } from "../SubstackImportUrl"

const expectedUrl = `${window.location.origin}/articles/my-article/substack.xml`

describe("SubstackImportUrl", () => {
  afterEach(() => {
    cleanup()
    mockFields = {}
    vi.clearAllMocks()
  })

  it("renders nothing until the article has a slug", () => {
    const { container } = render(<SubstackImportUrl />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the single-article feed URL", () => {
    mockFields = { slug: { value: "my-article" } }
    render(<SubstackImportUrl />)
    expect(screen.getByText(expectedUrl)).toBeInTheDocument()
  })

  it("copies the URL to the clipboard", async () => {
    mockFields = { slug: { value: "my-article" } }
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<SubstackImportUrl />)
    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }))

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
    expect(writeText).toHaveBeenCalledWith(expectedUrl)
  })

  it("reports when the clipboard is unavailable", async () => {
    mockFields = { slug: { value: "my-article" } }
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } })

    render(<SubstackImportUrl />)
    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
  })
})
