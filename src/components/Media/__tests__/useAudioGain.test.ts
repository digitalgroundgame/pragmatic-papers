import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useAudioGain } from "../useAudioGain"

/**
 * Two paths to cover: the Web Audio graph (same-origin media, gain ramped on the
 * audio thread) and the fallback (`audio.volume` written in bounded steps), which
 * is what keeps a fast drag from crackling on cross-origin media. jsdom ships no
 * Web Audio, so the graph is stubbed.
 */

const MAX_STEP_PER_FRAME = 0.03
const RAMP_TIME_CONSTANT = 0.02

class FakeAudioParam {
  value = 0
  setTargetAtTime = vi.fn()
}

class FakeGainNode {
  gain = new FakeAudioParam()
  // Web Audio returns the destination so `a.connect(b).connect(c)` chains.
  connect = vi.fn((destination: unknown) => destination)
}

class FakeSourceNode {
  connect = vi.fn((destination: unknown) => destination)
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  static failToConstruct = false

  currentTime = 4.5
  destination = { name: "destination" }
  gain = new FakeGainNode()
  source = new FakeSourceNode()
  createGain = vi.fn(() => this.gain)
  createMediaElementSource = vi.fn(() => this.source)
  resume = vi.fn(async () => undefined)
  close = vi.fn(async () => undefined)

  constructor() {
    if (FakeAudioContext.failToConstruct) throw new Error("Web Audio unavailable")
    FakeAudioContext.instances.push(this)
  }
}

function context(index = 0): FakeAudioContext {
  const instance = FakeAudioContext.instances[index]
  if (!instance) throw new Error(`no audio context at index ${index}`)
  return instance
}

interface Harness {
  audio: HTMLAudioElement
  ref: { current: HTMLAudioElement | null }
  result: { current: ReturnType<typeof useAudioGain> }
  unmount: () => void
}

function setup(src?: string): Harness {
  const audio = document.createElement("audio")
  if (src !== undefined) audio.src = src
  audio.volume = 1
  const ref: { current: HTMLAudioElement | null } = { current: audio }
  const { result, unmount } = renderHook(() => useAudioGain(ref))
  return { audio, ref, result, unmount }
}

function runFrames(count: number): void {
  act(() => {
    vi.advanceTimersByTime(count * 16)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeAudioContext.instances = []
  FakeAudioContext.failToConstruct = false
  vi.stubGlobal("AudioContext", FakeAudioContext)
})

afterEach(() => {
  // Restore before dropping the fake clock: a spy left on `requestAnimationFrame`
  // would otherwise outlive this test's timers and swallow the next one's frames.
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("useAudioGain — element fallback", () => {
  it("steps toward the target instead of jumping to it", () => {
    const { audio, result } = setup()

    act(() => result.current.setGain(0))
    runFrames(1)

    expect(audio.volume).toBeLessThan(1)
    expect(audio.volume).toBeCloseTo(1 - MAX_STEP_PER_FRAME, 5)
  })

  it("never moves more than one step per frame on the way down", () => {
    const { audio, result } = setup()
    const seen: number[] = [audio.volume]

    act(() => result.current.setGain(0))
    for (let i = 0; i < 40; i++) {
      runFrames(1)
      seen.push(audio.volume)
    }

    const steps = seen.slice(1).map((v, i) => Math.abs(v - seen[i]!))
    expect(Math.max(...steps)).toBeLessThanOrEqual(MAX_STEP_PER_FRAME + 1e-9)
    expect(audio.volume).toBe(0)
  })

  it("lands exactly on the target", () => {
    const { audio, result } = setup()

    act(() => result.current.setGain(0.42))
    runFrames(40)

    expect(audio.volume).toBe(0.42)
  })

  it("follows a target that keeps moving mid-glide", () => {
    const { audio, result } = setup()

    act(() => result.current.setGain(0))
    runFrames(3)
    expect(audio.volume).toBeLessThan(1)

    act(() => result.current.setGain(1))
    runFrames(40)

    expect(audio.volume).toBe(1)
  })

  it("does not touch the element before a gain is requested", () => {
    const { audio } = setup()
    runFrames(5)
    expect(audio.volume).toBe(1)
  })

  it("keeps one frame in flight however often the target moves", () => {
    const { result } = setup()
    const requestFrame = vi.spyOn(globalThis, "requestAnimationFrame")

    act(() => {
      result.current.setGain(0.9)
      result.current.setGain(0.5)
      result.current.setGain(0.1)
    })

    expect(requestFrame).toHaveBeenCalledTimes(1)
  })

  it("clamps a gain above the range", () => {
    const { audio, result } = setup()

    act(() => result.current.setGain(0.5))
    runFrames(40)
    act(() => result.current.setGain(7))
    runFrames(40)

    expect(audio.volume).toBe(1)
  })

  it("clamps a gain below the range", () => {
    const { audio, result } = setup()

    act(() => result.current.setGain(-7))
    runFrames(40)

    expect(audio.volume).toBe(0)
  })

  it("stops gliding when the element goes away mid-glide", () => {
    const { audio, ref, result } = setup()

    act(() => result.current.setGain(0))
    runFrames(1)
    const stopped = audio.volume
    ref.current = null

    expect(() => runFrames(10)).not.toThrow()
    expect(audio.volume).toBe(stopped)
  })

  it("cancels a pending glide when the component unmounts", () => {
    const { audio, result, unmount } = setup()

    act(() => result.current.setGain(0))
    runFrames(1)
    const stopped = audio.volume
    unmount()
    runFrames(20)

    expect(audio.volume).toBe(stopped)
  })
})

describe("useAudioGain — Web Audio graph", () => {
  it("routes same-origin media through a gain node", () => {
    const { audio, result } = setup("/narration.mp3")

    act(() => result.current.connect())

    const ctx = context()
    expect(ctx.createMediaElementSource).toHaveBeenCalledWith(audio)
    expect(ctx.source.connect).toHaveBeenCalledWith(ctx.gain)
    expect(ctx.gain.connect).toHaveBeenCalledWith(ctx.destination)
    expect(ctx.resume).toHaveBeenCalled()
    // The element's own volume multiplies the graph, so it is left wide open.
    expect(audio.volume).toBe(1)
  })

  it("seeds the gain node with the level already requested", () => {
    const { result } = setup("/narration.mp3")

    act(() => result.current.setGain(0.4))
    act(() => result.current.connect())

    expect(context().gain.gain.value).toBe(0.4)
  })

  it("ramps on the audio thread and leaves the element alone", () => {
    const { audio, result } = setup("/narration.mp3")
    act(() => result.current.connect())
    const requestFrame = vi.spyOn(globalThis, "requestAnimationFrame")

    act(() => result.current.setGain(0.25))
    runFrames(10)

    const ctx = context()
    expect(ctx.gain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.25,
      ctx.currentTime,
      RAMP_TIME_CONSTANT,
    )
    expect(requestFrame).not.toHaveBeenCalled()
    expect(audio.volume).toBe(1)
  })

  it("clamps the ramped gain to the range", () => {
    const { result } = setup("/narration.mp3")
    act(() => result.current.connect())

    act(() => result.current.setGain(4))

    expect(context().gain.gain.setTargetAtTime).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      RAMP_TIME_CONSTANT,
    )
  })

  it("resumes the existing context on later plays rather than rebuilding it", () => {
    const { result } = setup("/narration.mp3")

    act(() => result.current.connect())
    act(() => result.current.connect())

    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(context().resume).toHaveBeenCalledTimes(2)
  })

  it("does nothing when there is no element to route", () => {
    const { ref, result } = setup("/narration.mp3")
    ref.current = null

    expect(() => act(() => result.current.connect())).not.toThrow()
    expect(FakeAudioContext.instances).toHaveLength(0)
  })

  it("leaves cross-origin media on the element", () => {
    const { audio, result } = setup("https://cdn.example.com/narration.mp3")

    act(() => result.current.connect())
    act(() => result.current.setGain(0))
    runFrames(40)

    expect(FakeAudioContext.instances).toHaveLength(0)
    expect(audio.volume).toBe(0)
  })

  it("treats an unparseable src as cross-origin", () => {
    const { result } = setup("http://[")

    act(() => result.current.connect())

    expect(FakeAudioContext.instances).toHaveLength(0)
  })

  it("skips the graph when the element has no source yet", () => {
    const { result } = setup()

    act(() => result.current.connect())

    expect(FakeAudioContext.instances).toHaveLength(0)
  })

  it("falls back to the element when the context cannot be built", () => {
    FakeAudioContext.failToConstruct = true
    const { audio, result } = setup("/narration.mp3")

    expect(() => act(() => result.current.connect())).not.toThrow()

    act(() => result.current.setGain(0))
    runFrames(40)
    expect(audio.volume).toBe(0)
  })

  it("closes the context on unmount", () => {
    const { result, unmount } = setup("/narration.mp3")
    act(() => result.current.connect())
    const ctx = context()

    unmount()

    expect(ctx.close).toHaveBeenCalled()
  })
})
