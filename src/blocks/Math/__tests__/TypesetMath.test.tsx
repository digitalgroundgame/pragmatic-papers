import { act, cleanup, render, screen } from "@testing-library/react"
import { MathJaxBaseContext } from "better-react-mathjax/esm"
import type { MathJaxSubscriberProps } from "better-react-mathjax"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TypesetMath } from "@/blocks/Math/TypesetMath"

vi.mock("better-react-mathjax/esm", async () => {
  const { createContext } = await import("react")
  return {
    MathJax: ({ children }: { children: React.ReactNode }) => (
      <span data-testid="typeset">{children}</span>
    ),
    MathJaxBaseContext: createContext(undefined),
  }
})

afterEach(() => {
  cleanup()
})

const renderWithLoad = (promise: Promise<unknown>) =>
  render(
    <MathJaxBaseContext.Provider value={{ version: 3, promise } as MathJaxSubscriberProps}>
      <TypesetMath inline>{"\\(E = mc^2\\)"}</TypesetMath>
    </MathJaxBaseContext.Provider>,
  )

describe("TypesetMath", () => {
  it("shows the raw TeX until MathJax has loaded", () => {
    renderWithLoad(new Promise(() => undefined))

    expect(screen.queryByTestId("typeset")).not.toBeInTheDocument()
    expect(screen.getByText("\\(E = mc^2\\)")).toHaveStyle({ display: "inline" })
  })

  it("hands the formula to MathJax once it has loaded", async () => {
    const load = Promise.resolve({})
    renderWithLoad(load)
    await act(() => load)

    expect(screen.getByTestId("typeset")).toHaveTextContent("\\(E = mc^2\\)")
  })

  it("keeps the raw TeX, without mounting MathJax, when the script fails to load", async () => {
    const load = Promise.reject(new Error("blocked"))
    renderWithLoad(load)
    await act(() => load.catch(() => undefined))

    expect(screen.queryByTestId("typeset")).not.toBeInTheDocument()
    expect(screen.getByText("\\(E = mc^2\\)")).toBeInTheDocument()
  })

  it("shows the raw TeX outside a MathJax provider", () => {
    render(<TypesetMath>{"\\[x = 1\\]"}</TypesetMath>)

    expect(screen.getByText("\\[x = 1\\]")).toHaveStyle({ display: "block" })
  })
})
