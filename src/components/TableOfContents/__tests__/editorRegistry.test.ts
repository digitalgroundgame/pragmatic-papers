import type { LexicalEditor } from "@payloadcms/richtext-lexical/lexical"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { getRegisteredEditor, registerEditor, useRegisteredEditor } from "../editorRegistry"

const fakeEditor = () => ({}) as LexicalEditor

describe("editorRegistry", () => {
  it("hands out the editor registered at a path until it unregisters", () => {
    const editor = fakeEditor()
    const unregister = registerEditor("content", editor)
    expect(getRegisteredEditor("content")).toBe(editor)

    unregister()
    expect(getRegisteredEditor("content")).toBeUndefined()
  })

  it("keeps a remounted editor when the old one unregisters after it", () => {
    const old = fakeEditor()
    const next = fakeEditor()
    const unregisterOld = registerEditor("content", old)
    const unregisterNext = registerEditor("content", next)

    unregisterOld()
    expect(getRegisteredEditor("content")).toBe(next)
    unregisterNext()
  })

  it("re-renders a hook when an editor registers and unregisters", () => {
    const { result } = renderHook(() => useRegisteredEditor("body"))
    expect(result.current).toBeUndefined()

    const editor = fakeEditor()
    let unregister: (() => void) | undefined
    act(() => {
      unregister = registerEditor("body", editor)
    })
    expect(result.current).toBe(editor)

    act(() => unregister?.())
    expect(result.current).toBeUndefined()
  })
})
