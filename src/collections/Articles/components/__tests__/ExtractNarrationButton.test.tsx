import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ExtractNarrationButton, resetNarrationCache } from "../ExtractNarrationButton"

type MockFields = Record<string, { value?: unknown } | undefined>
let mockFields: MockFields = {}

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

vi.mock("@payloadcms/ui", () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
  useFormFields: <T,>(selector: (args: [MockFields, unknown]) => T): T =>
    selector([mockFields, vi.fn()]),
  useDocumentInfo: () => ({ id: "test-doc-id" }),
}))

afterEach(() => {
  cleanup()
  mockFields = {}
  resetNarrationCache()
  vi.clearAllMocks()
})

describe("ExtractNarrationButton", () => {
  beforeEach(() => {
    resetNarrationCache()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it("renders the generate button and shows formatted view and editable textarea on view toggle", async () => {
    mockFields = {
      title: { value: "Sample Article Title" },
      populatedAuthors: { value: [{ name: "Alice Author" }] },
      publishedAt: { value: "2026-07-20T00:00:00.000Z" },
      content: {
        value: {
          root: {
            type: "root",
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Hello world narration text." }],
              },
            ],
          },
        },
      },
    }

    render(<ExtractNarrationButton />)

    expect(screen.queryByLabelText(/formatted narration preview/i)).toBeNull()

    const button = await screen.findByRole("button", { name: /generate narration text/i })
    expect(button).toBeDefined()

    fireEvent.click(button)
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text generated!")
    })

    const formattedPreview = screen.getByLabelText(/formatted narration preview/i)
    expect(formattedPreview).toBeDefined()
    expect(formattedPreview.textContent).toContain("Sample Article Title")
    expect(formattedPreview.textContent).toContain("By Alice Author")
    expect(formattedPreview.textContent).toContain("Hello world narration text.")

    const editBtn = screen.getByRole("button", { name: /edit text/i })
    fireEvent.click(editBtn)

    const textarea = screen.getByRole("textbox", {
      name: /editable narration plain text/i,
    }) as HTMLTextAreaElement
    expect(textarea).toBeDefined()
    expect(textarea.value).toContain("Sample Article Title")
    expect(textarea.value).toContain("By Alice Author")
    expect(textarea.value).toContain("Hello world narration text.")

    expect(screen.getByRole("button", { name: /regenerate text/i })).toBeDefined()
  })

  it("copies text to clipboard and shows success toast", async () => {
    mockFields = {
      title: { value: "Sample Article Title" },
    }

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    const copyBtn = await screen.findByRole("button", { name: /copy to clipboard/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Sample Article Title\n<break time="1.5s" />',
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text copied to clipboard!")
    })
  })

  it("persists edited text across unmount and remount (switching tabs)", async () => {
    mockFields = {
      title: { value: "Initial Title" },
    }

    // 1. First render (in Narration tab)
    const { unmount } = render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    const editBtn = await screen.findByRole("button", { name: /edit text/i })
    fireEvent.click(editBtn)

    const textarea = screen.getByRole("textbox", {
      name: /editable narration plain text/i,
    }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Custom edited narration text!" } })

    // 2. Simulate switching tabs away (component unmounts)
    unmount()

    // 3. Simulate switching back to Narration tab (component remounts)
    render(<ExtractNarrationButton />)

    const editBtnRemounted = screen.getByRole("button", { name: /edit text/i })
    fireEvent.click(editBtnRemounted)

    const remountedTextarea = (await screen.findByRole("textbox", {
      name: /editable narration plain text/i,
    })) as HTMLTextAreaElement

    expect(remountedTextarea.value).toBe("Custom edited narration text!")
    expect(screen.getByRole("button", { name: /regenerate text/i })).toBeDefined()
  })

  it("overwrites persisted text and shows regenerated toast when Regenerate Text is clicked", async () => {
    mockFields = {
      title: { value: "Initial Title" },
    }

    const { rerender } = render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text generated!")
    })

    const editBtn = screen.getByRole("button", { name: /edit text/i })
    fireEvent.click(editBtn)

    const textarea = screen.getByRole("textbox", {
      name: /editable narration plain text/i,
    }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Edited before regenerate" } })

    // Update field value, rerender, and click Regenerate
    mockFields = { title: { value: "Updated Title" } }
    rerender(<ExtractNarrationButton />)
    const regenerateBtn = screen.getByRole("button", { name: /regenerate text/i })
    fireEvent.click(regenerateBtn)

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text regenerated!")
    })

    const regeneratedTextarea = screen.getByRole("textbox", {
      name: /editable narration plain text/i,
    }) as HTMLTextAreaElement
    expect(regeneratedTextarea.value).toContain("Updated Title")
    expect(regeneratedTextarea.value).not.toContain("Edited before regenerate")
  })
})
