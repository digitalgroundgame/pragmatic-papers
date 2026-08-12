import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type * as ReactTypes from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ExtractNarrationTextOptions } from "@/utilities/extractNarrationText"
import type * as extractModule from "@/utilities/extractNarrationText"

const { mockRef } = vi.hoisted(() => ({ mockRef: { shouldMockNotMounted: false } }))

vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof ReactTypes>()
  return {
    ...original,
    useSyncExternalStore: (
      subscribe: (onStoreChange: () => void) => () => void,
      getSnapshot: () => boolean,
      getServerSnapshot?: () => boolean,
    ) => {
      if (mockRef.shouldMockNotMounted) {
        return false
      }
      return original.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
    },
  }
})

import { ExtractNarrationButton, resetNarrationCache } from "../ExtractNarrationButton"

type MockFields = Record<string, { value?: unknown } | undefined>
let mockFields: MockFields = {}

// An article being created has no id yet, so `useDocumentInfo()` returns one
// without one — the cache then has to key off something else.
const savedDocInfo = { id: "test-doc-id" }
let mockDocInfo: { id?: string | number } = savedDocInfo

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
  useDocumentInfo: () => mockDocInfo,
}))

let shouldThrowGenerationError = false

vi.mock("@/utilities/extractNarrationText", async (importOriginal) => {
  const original = await importOriginal<typeof extractModule>()
  return {
    ...original,
    extractNarrationText: (options: ExtractNarrationTextOptions) => {
      if (shouldThrowGenerationError) {
        throw new Error("Mock Generation Error")
      }
      return original.extractNarrationText(options)
    },
  }
})

afterEach(() => {
  cleanup()
  mockFields = {}
  mockDocInfo = savedDocInfo
  shouldThrowGenerationError = false
  mockRef.shouldMockNotMounted = false
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
      authors: { value: [{ id: 1, name: "Alice Author" }] },
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
      name: /editable narration script/i,
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
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Sample Article Title")
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
      name: /editable narration script/i,
    }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Custom edited narration text!" } })

    // 2. Simulate switching tabs away (component unmounts)
    unmount()

    // 3. Simulate switching back to Narration tab (component remounts)
    render(<ExtractNarrationButton />)

    const editBtnRemounted = screen.getByRole("button", { name: /edit text/i })
    fireEvent.click(editBtnRemounted)

    const remountedTextarea = (await screen.findByRole("textbox", {
      name: /editable narration script/i,
    })) as HTMLTextAreaElement

    expect(remountedTextarea.value).toBe("Custom edited narration text!")
    expect(screen.getByRole("button", { name: /regenerate text/i })).toBeDefined()
  })

  it("caches an unsaved article's script separately from a saved one", async () => {
    mockFields = { title: { value: "Saved Article" } }

    // A saved article caches under its document id.
    const saved = render(<ExtractNarrationButton />)
    fireEvent.click(await screen.findByRole("button", { name: /generate narration text/i }))
    await screen.findByRole("button", { name: /regenerate text/i })
    saved.unmount()

    // A brand new article has no id yet, so it must not inherit the saved
    // article's script — it falls back to a path-keyed cache entry.
    mockDocInfo = {}
    mockFields = { title: { value: "Unsaved Draft" } }
    const unsaved = render(<ExtractNarrationButton />)
    expect(screen.queryByRole("button", { name: /regenerate text/i })).toBeNull()

    fireEvent.click(await screen.findByRole("button", { name: /generate narration text/i }))
    fireEvent.click(await screen.findByRole("button", { name: /edit text/i }))
    fireEvent.change(screen.getByRole("textbox", { name: /editable narration script/i }), {
      target: { value: "Draft narration" },
    })
    unsaved.unmount()

    // Switching tabs away and back keeps the unsaved draft's script.
    render(<ExtractNarrationButton />)
    fireEvent.click(await screen.findByRole("button", { name: /edit text/i }))
    const remounted = (await screen.findByRole("textbox", {
      name: /editable narration script/i,
    })) as HTMLTextAreaElement

    expect(remounted.value).toBe("Draft narration")
  })

  it("skips blank lines when rendering the formatted script", async () => {
    mockFields = {
      title: { value: "Spacing Test" },
      content: {
        value: {
          root: {
            type: "root",
            children: [
              {
                type: "paragraph",
                children: [
                  { type: "text", text: "First line" },
                  { type: "linebreak" },
                  // Soft breaks around a whitespace-only run leave a blank line
                  // inside the paragraph, which must not render as an empty row.
                  { type: "text", text: "   " },
                  { type: "linebreak" },
                  { type: "text", text: "Second line" },
                ],
              },
            ],
          },
        },
      },
    }

    render(<ExtractNarrationButton />)
    fireEvent.click(await screen.findByRole("button", { name: /generate narration text/i }))

    const firstLine = await screen.findByText("First line")
    const lines = Array.from(firstLine.parentElement?.children ?? [])

    expect(lines.map((el) => el.textContent)).toEqual(["First line", "Second line"])
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
      name: /editable narration script/i,
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
      name: /editable narration script/i,
    }) as HTMLTextAreaElement
    expect(regeneratedTextarea.value).toContain("Updated Title")
    expect(regeneratedTextarea.value).not.toContain("Edited before regenerate")
  })

  it("renders formatted break badges correctly in formatted view", async () => {
    mockFields = {
      title: { value: "Break Badge Title" },
      content: {
        value: {
          root: {
            type: "root",
            children: [
              {
                type: "paragraph",
                children: [
                  { type: "text", text: "Text before break" },
                  { type: "linebreak" },
                  { type: "text", text: '<break time="3s" />' },
                ],
              },
            ],
          },
        },
      },
    }

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    await screen.findByRole("button", { name: /copy to clipboard/i })
    const formattedPreview = screen.getByLabelText(/formatted narration preview/i)
    expect(formattedPreview).toBeDefined()
    expect(formattedPreview.textContent).toContain('<break time="3s" />')
  })

  it("handles generation errors gracefully", async () => {
    mockFields = {
      title: { value: "Error Handling Test" },
    }

    shouldThrowGenerationError = true

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to generate narration text: Mock Generation Error"),
      )
    })
  })

  it("handles clipboard errors gracefully", async () => {
    mockFields = { title: { value: "Clipboard Error Test" } }
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission Denied")),
      },
    })

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    const copyBtn = await screen.findByRole("button", { name: /copy to clipboard/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to copy narration text to clipboard: Permission Denied"),
      )
    })
  })

  it("traverses media blocks and fetches media via batch API in component", async () => {
    mockFields = {
      title: { value: "Media Fetch Test" },
      content: {
        value: {
          root: {
            type: "root",
            children: [
              {
                type: "block",
                fields: {
                  blockType: "mediaBlock",
                  media: 456,
                },
              },
            ],
          },
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        docs: [
          {
            id: 456,
            alt: "Traversed Image Alt Text",
            filename: "image.png",
          },
        ],
      }),
    })
    vi.stubGlobal("fetch", mockFetch)

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text generated!")
    })

    const formattedPreview = screen.getByLabelText(/formatted narration preview/i)
    expect(formattedPreview.textContent).toContain("(An image: Traversed Image Alt Text.)")

    vi.unstubAllGlobals()
  })

  it("logs console error when media fetch endpoint fails", async () => {
    mockFields = {
      title: { value: "Media Fetch Failure Test" },
      content: {
        value: {
          root: {
            type: "root",
            children: [{ type: "block", fields: { blockType: "mediaBlock", media: 999 } }],
          },
        },
      },
    }

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // no-op
    })
    const mockFetch = vi.fn().mockRejectedValue(new Error("Fetch Failure"))
    vi.stubGlobal("fetch", mockFetch)

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text generated!")
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch media documents for narration extraction:",
        expect.any(Error),
      )
    })

    consoleSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it("renders loading state when not mounted", () => {
    mockRef.shouldMockNotMounted = true
    render(<ExtractNarrationButton />)
    expect(screen.getByText("Loading narration tools...")).toBeDefined()
  })

  it("covers multiple traversal branches in collectMediaIdsFromContent", async () => {
    mockFields = {
      title: { value: "Media Traversal Object Test" },
      content: {
        value: {
          root: {
            type: "root",
            children: [
              {
                type: "block",
                fields: {
                  blockType: "mediaBlock",
                  media: {
                    id: 111,
                  },
                },
              },
              {
                type: "block",
                fields: {
                  blockType: "mediaBlock",
                  media: {
                    value: 222,
                  },
                },
              },
              {
                type: "block",
                fields: {
                  blockType: "mediaCollage",
                  images: [
                    {
                      media: 333,
                    },
                    {
                      media: {
                        id: 444,
                      },
                    },
                    {
                      media: {
                        value: 555,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        docs: [
          { id: 111, alt: "Alt 1" },
          { id: 222, alt: "Alt 2" },
          { id: 333, alt: "Alt 3" },
          { id: 444, alt: "Alt 4" },
          { id: 555, alt: "Alt 5" },
        ],
      }),
    })
    vi.stubGlobal("fetch", mockFetch)

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text generated!")
    })

    const formattedPreview = screen.getByLabelText(/formatted narration preview/i)
    expect(formattedPreview.textContent).toContain("(An image: Alt 1.)")
    expect(formattedPreview.textContent).toContain("(An image: Alt 2.)")
    expect(formattedPreview.textContent).toContain("(A gallery of images: Alt 3; Alt 4; Alt 5.)")

    vi.unstubAllGlobals()
  })

  it("resolves bare author IDs via the users fetch API in component", async () => {
    mockFields = {
      title: { value: "Author Fetch Test" },
      authors: { value: [123, 789] },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        docs: [
          { id: 123, name: "Fetched Author One" },
          { id: 789, name: "Fetched Author Two" },
        ],
      }),
    })
    vi.stubGlobal("fetch", mockFetch)

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text generated!")
    })

    const formattedPreview = screen.getByLabelText(/formatted narration preview/i)
    expect(formattedPreview.textContent).toContain("By Fetched Author One, Fetched Author Two")

    expect(mockFetch).toHaveBeenCalled()
    const callUrls = mockFetch.mock.calls.map((call) => call[0])
    expect(callUrls.some((url) => typeof url === "string" && url.includes("/api/users"))).toBe(true)

    vi.unstubAllGlobals()
  })

  it("handles fetch failure gracefully and falls back to excluding unresolvable authors", async () => {
    mockFields = {
      title: { value: "Author Fetch Failure Test" },
      authors: { value: [123] },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    })
    vi.stubGlobal("fetch", mockFetch)

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text generated!")
    })

    const formattedPreview = screen.getByLabelText(/formatted narration preview/i)
    expect(formattedPreview.textContent).not.toContain("123")
    expect(formattedPreview.textContent).not.toContain("By")

    vi.unstubAllGlobals()
  })

  it("skips unresolvable author IDs (line 297 fallback)", async () => {
    mockFields = {
      title: { value: "Author Fetch Partial Success Test" },
      authors: { value: [123, 999] },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        docs: [{ id: 123, name: "Fetched Author One" }],
      }),
    })
    vi.stubGlobal("fetch", mockFetch)

    render(<ExtractNarrationButton />)
    const generateBtn = await screen.findByRole("button", { name: /generate narration text/i })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Narration text generated!")
    })

    const formattedPreview = screen.getByLabelText(/formatted narration preview/i)
    expect(formattedPreview.textContent).toContain("By Fetched Author One")
    expect(formattedPreview.textContent).not.toContain("999")

    vi.unstubAllGlobals()
  })
})
