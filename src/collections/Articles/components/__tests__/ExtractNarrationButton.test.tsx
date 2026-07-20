import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ExtractNarrationButton } from "../ExtractNarrationButton"

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
}))

afterEach(() => {
  cleanup()
  mockFields = {}
  vi.clearAllMocks()
})

describe("ExtractNarrationButton", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it("renders the generate button and shows textarea in tab on click", async () => {
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

    expect(screen.queryByRole("textbox", { name: /editable narration plain text/i })).toBeNull()

    const button = await screen.findByRole("button", { name: /generate narration text/i })
    expect(button).toBeDefined()

    fireEvent.click(button)

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

    const copyBtn = screen.getByRole("button", { name: /copy to clipboard/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Sample Article Title\n<break time="1.5s" />',
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text copied to clipboard!")
    })
  })
})
