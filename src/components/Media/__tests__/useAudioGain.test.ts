import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useAudioGain } from "../useAudioGain"

/**
 * jsdom has no Web Audio, so these cover the fallback: `audio.volume` written
 * in bounded steps rather than jumped to the new value, which is what keeps a
 * fast drag from crackling on cross-origin media.
 */

const MAX_STEP_PER_FRAME = 0.03

function setup(): {
  audio: HTMLAudioElement
  result: { current: ReturnType<typeof useAudioGain> }
} {
  const audio = document.createElement("audio")
  audio.volume = 1
  const { result } = renderHook(() => useAudioGain({ current: audio }))
  return { audio, result }
}

function runFrames(count: number): void {
  act(() => {
    vi.advanceTimersByTime(count * 16)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useAudioGain", () => {
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
    const midway = audio.volume
    expect(midway).toBeLessThan(1)

    act(() => result.current.setGain(1))
    runFrames(40)

    expect(audio.volume).toBe(1)
  })

  it("does not touch the element before a gain is requested", () => {
    const { audio } = setup()
    runFrames(5)
    expect(audio.volume).toBe(1)
  })
})
