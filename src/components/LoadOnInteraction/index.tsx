"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from "react"

// What the reader can press or focus. The placeholder and the component it stands in for
// render the same ones in the same order, so an index into one finds the match in the other.
const CONTROLS = "a[href], button"

interface LoadOnInteractionProps<P extends object> {
  /**
   * Imports the interactive component, from a module of its own so its code (and its
   * dependencies) stays out of the chunks the page loads first. Called once, when the reader
   * first reaches for the placeholder.
   */
  load: () => Promise<React.ComponentType<P>>
  /** What the loaded component is rendered with. */
  props: P
  /**
   * What renders until then, on the server and in the browser: markup that looks the same as
   * the loaded component and carries the same links and buttons, so the swap moves nothing and
   * crawlers and readers without JavaScript get the links.
   */
  children: React.ReactNode
}

/**
 * Renders `children` until the reader points at, touches, focuses or clicks them, then swaps in
 * the component `load` imports. Menus, sheets and toggles a reader may never open don't have to
 * be downloaded and hydrated before the page is interactive.
 *
 * Pointing or focusing starts the import, so it has usually arrived by the time the reader
 * clicks. If it hasn't, the click on a placeholder button is kept and replayed on the matching
 * button once the component is in (a placeholder link just navigates), and focus moves to the
 * matching control, so a keyboard reader carries on where they were. The swap waits while a
 * pointer is pressed, so a click never starts on one element and ends on another.
 *
 * Not `next/dynamic`: its loading state would replace the placeholder with a fallback for a
 * moment, losing focus and the pending click. Nothing here renders on the server but the
 * placeholder, so there's no server rendering for `next/dynamic` to keep.
 */
export function LoadOnInteraction<P extends object>({
  load,
  props,
  children,
}: LoadOnInteractionProps<P>): React.ReactNode {
  const [Loaded, setLoaded] = useState<React.ComponentType<P>>()
  const container = useRef<HTMLDivElement>(null)
  const state = useRef({
    started: false,
    pressed: false,
    ready: undefined as React.ComponentType<P> | undefined,
    // The placeholder control that had focus, and the one clicked, as an index into CONTROLS.
    focused: -1,
    clicked: -1,
  })

  const indexOf = (element: Element | null): number => {
    const control = element?.closest(CONTROLS)
    if (!control || !container.current?.contains(control)) return -1
    return [...container.current.querySelectorAll(CONTROLS)].indexOf(control)
  }

  const swap = (): void => {
    const { ready, pressed } = state.current
    if (!ready || pressed) return
    state.current.focused = indexOf(document.activeElement)
    setLoaded(() => ready)
  }

  const start = (): void => {
    if (state.current.started) return
    state.current.started = true
    load().then(
      (component) => {
        state.current.ready = component
        swap()
      },
      // The chunk didn't arrive: the placeholder stays, and the next interaction tries again.
      () => {
        state.current.started = false
      },
    )
  }

  const press = (): void => {
    state.current.pressed = true
    const released = new AbortController()
    const release = (): void => {
      released.abort()
      state.current.pressed = false
      // After the click that follows this pointerup, so the click lands on the placeholder.
      window.setTimeout(swap, 0)
    }
    window.addEventListener("pointerup", release, { signal: released.signal })
    window.addEventListener("pointercancel", release, { signal: released.signal })
  }

  // Focus goes back where it was in the same commit as the swap, before the reader sees it lost.
  useLayoutEffect(() => {
    if (!Loaded) return
    const { focused } = state.current
    if (focused < 0 || !container.current) return
    container.current.querySelectorAll<HTMLElement>(CONTROLS)[focused]?.focus()
  }, [Loaded])

  // The click replays once the component's own effects have run and it can respond to it.
  useEffect(() => {
    if (!Loaded) return
    const { clicked } = state.current
    state.current.clicked = -1
    if (clicked < 0 || !container.current) return
    container.current.querySelectorAll<HTMLElement>(CONTROLS)[clicked]?.click()
  }, [Loaded])

  if (Loaded) {
    return (
      <div ref={container} className="contents">
        <Loaded {...props} />
      </div>
    )
  }

  return (
    // The placeholder's own controls are what the reader interacts with; this only listens.
    <div
      ref={container}
      className="contents"
      onPointerOver={start}
      onFocus={start}
      onTouchStart={start}
      onPointerDown={(event) => {
        start()
        if (event.button === 0 && !state.current.pressed) press()
      }}
      onClick={(event) => {
        start()
        const target = (event.target as Element).closest(CONTROLS)
        // A placeholder link works as it is; a placeholder button does nothing until the real
        // one is in, so its click is kept for that.
        if (target?.tagName === "BUTTON") state.current.clicked = indexOf(target)
      }}
    >
      {children}
    </div>
  )
}
