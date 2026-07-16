import { act, cleanup, render, screen } from "@testing-library/react"
import type { NumberFieldClientProps } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DurationField } from "../DurationField"

type MockFields = Record<string, { value?: unknown } | undefined>

let mockFields: MockFields = {}
let mockValue: number | undefined
const mockSetValue = vi.fn()
const mockUseField = vi.fn((_args: { path: string }) => ({
  value: mockValue,
  setValue: mockSetValue,
}))

vi.mock("@payloadcms/ui", () => ({
  FieldLabel: ({ label }: { label: string }) => <span>{label}</span>,
  useField: (args: { path: string }) => mockUseField(args),
  useFormFields: <T,>(selector: (args: [MockFields, unknown]) => T): T =>
    selector([mockFields, vi.fn()]),
}))

// jsdom has no media pipeline: `load()` is unimplemented and `duration` never
// resolves. Stand in a fake so tests can drive the metadata events directly.
class FakeAudio {
  static instances: FakeAudio[] = []

  duration = NaN
  currentTime = 0
  readonly src: string
  private listeners: Record<string, Array<() => void>> = {}

  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }

  addEventListener(type: string, fn: () => void) {
    ;(this.listeners[type] ??= []).push(fn)
  }

  removeEventListener(type: string, fn: () => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== fn)
  }

  load() {
    // The component calls this to kick off metadata loading; tests emit instead.
  }

  emit(type: string) {
    act(() => {
      for (const fn of this.listeners[type] ?? []) fn()
    })
  }

  get listenerCount() {
    return Object.values(this.listeners).flat().length
  }
}

const props = {
  field: { name: "duration", label: "Duration" },
  path: "duration",
} as NumberFieldClientProps

const audioFile = (name = "narration.mp3") => new File(["id3"], name, { type: "audio/mpeg" })
const lastAudio = (): FakeAudio => {
  const audio = FakeAudio.instances.at(-1)
  if (!audio) throw new Error("expected the component to have constructed an Audio element")
  return audio
}
const renderWith = (fields: MockFields) => {
  mockFields = fields
  const utils = render(<DurationField {...props} />)
  return {
    ...utils,
    rerenderWith: (next: MockFields) => {
      mockFields = next
      utils.rerender(<DurationField {...props} />)
    },
  }
}

beforeEach(() => {
  FakeAudio.instances = []
  mockValue = undefined
  vi.stubGlobal("Audio", FakeAudio)
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  mockSetValue.mockClear()
  mockUseField.mockClear()
  mockFields = {}
})

describe("DurationField", () => {
  it("binds to the field name when no explicit path is given", () => {
    mockFields = { file: { value: audioFile() } }
    render(<DurationField {...props} path={undefined as unknown as string} />)

    expect(mockUseField).toHaveBeenCalledWith({ path: "duration" })
  })

  it("hides for a non-audio upload", () => {
    renderWith({ file: { value: new File([""], "a.jpg", { type: "image/jpeg" }) } })

    expect(screen.queryByText("Duration")).toBeNull()
  })

  it("shows for a pending audio file that has not been saved yet", () => {
    renderWith({ file: { value: audioFile() } })

    expect(screen.getByText("Duration")).toBeTruthy()
  })

  it("reads a pending file from memory rather than waiting for a saved url", () => {
    const file = audioFile()
    renderWith({ file: { value: file } })

    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(lastAudio().src).toBe("blob:narration.mp3")
  })

  it("stores the duration once metadata for a pending file loads", () => {
    renderWith({ file: { value: audioFile() } })

    lastAudio().duration = 90
    lastAudio().emit("loadedmetadata")

    expect(mockSetValue).toHaveBeenCalledWith(90)
  })

  it("prefers the pending file over the saved url when a file is replaced", () => {
    renderWith({
      file: { value: audioFile() },
      mimeType: { value: "audio/mpeg" },
      url: { value: "https://cdn.example.com/old.mp3" },
    })

    expect(lastAudio().src).toBe("blob:narration.mp3")
  })

  it("falls back to the saved url for a stored record with no pending file", () => {
    renderWith({
      mimeType: { value: "audio/mpeg" },
      url: { value: "https://cdn.example.com/a.mp3" },
    })

    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(lastAudio().src).toBe("https://cdn.example.com/a.mp3")
  })

  it("skips recalculation when opening a record that already has a duration", () => {
    mockValue = 90
    renderWith({
      mimeType: { value: "audio/mpeg" },
      url: { value: "https://cdn.example.com/a.mp3" },
    })

    expect(mockSetValue).not.toHaveBeenCalled()
    expect(screen.getByText("1:30")).toBeTruthy()
  })

  it("seeks past the end to resolve a file that reports no duration header", () => {
    renderWith({ file: { value: audioFile() } })

    lastAudio().duration = Infinity
    lastAudio().emit("loadedmetadata")

    expect(mockSetValue).not.toHaveBeenCalled()
    expect(lastAudio().currentTime).toBe(1e9)

    lastAudio().duration = 42
    lastAudio().emit("durationchange")

    expect(mockSetValue).toHaveBeenCalledWith(42)
    expect(lastAudio().currentTime).toBe(0)
  })

  it("stores the duration when it resolves without a prior seek", () => {
    renderWith({ file: { value: audioFile() } })

    lastAudio().duration = 42
    lastAudio().emit("durationchange")

    expect(mockSetValue).toHaveBeenCalledWith(42)
    expect(lastAudio().currentTime).toBe(0)
  })

  it("ignores a duration change that has not resolved to a finite value", () => {
    renderWith({ file: { value: audioFile() } })

    lastAudio().duration = Infinity
    lastAudio().emit("durationchange")

    expect(mockSetValue).not.toHaveBeenCalled()
  })

  it("recalculates when a stored record's file is swapped for another", () => {
    mockValue = 90
    const { rerenderWith } = renderWith({
      mimeType: { value: "audio/mpeg" },
      url: { value: "https://cdn.example.com/a.mp3" },
    })

    expect(mockSetValue).not.toHaveBeenCalled()

    rerenderWith({
      file: { value: audioFile("replacement.mp3") },
      mimeType: { value: "audio/mpeg" },
      url: { value: "https://cdn.example.com/a.mp3" },
    })

    expect(lastAudio().src).toBe("blob:replacement.mp3")

    lastAudio().duration = 12
    lastAudio().emit("loadedmetadata")

    expect(mockSetValue).toHaveBeenCalledWith(12)
  })

  it("shows a placeholder while no duration has resolved yet", () => {
    renderWith({ file: { value: audioFile() } })

    expect(screen.getByText("Calculating…")).toBeTruthy()
  })

  it("shows a placeholder for an audio record with no file to measure", () => {
    renderWith({ mimeType: { value: "audio/mpeg" } })

    expect(screen.getByText("—")).toBeTruthy()
    expect(FakeAudio.instances).toHaveLength(0)
  })

  it("releases the object url and media listeners on unmount", () => {
    const { unmount } = renderWith({ file: { value: audioFile() } })
    const audio = lastAudio()

    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:narration.mp3")
    expect(audio.listenerCount).toBe(0)
  })
})
