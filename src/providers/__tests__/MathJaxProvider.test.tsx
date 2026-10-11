import { render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { captureMessage, loadError, contextProps } = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  loadError: { current: null as unknown },
  contextProps: vi.fn(),
}))

vi.mock("@/sentryClient", () => ({ captureMessage }))
// Stands in for the library's context: reports `loadError` through `onError` once mounted,
// as the real one does when the MathJax script fails to load.
vi.mock("better-react-mathjax", () => ({
  MathJaxContext: ({
    onError,
    children,
    ...props
  }: {
    onError: (error: unknown) => void
    children: React.ReactNode
  }) => {
    contextProps(props)
    React.useEffect(() => {
      if (loadError.current) onError(loadError.current)
    }, [onError])
    return <div data-testid="mathjax-context">{children}</div>
  },
}))

import { MathJaxProvider } from "../MathJaxProvider"

describe("MathJaxProvider", () => {
  beforeEach(() => {
    loadError.current = null
    captureMessage.mockClear()
    contextProps.mockClear()
  })

  it("leaves pages without math alone: no MathJax at all", () => {
    render(<MathJaxProvider enableMathRendering={false}>article</MathJaxProvider>)
    expect(screen.getByText("article")).toBeInTheDocument()
    expect(screen.queryByTestId("mathjax-context")).not.toBeInTheDocument()
  })

  it("loads MathJax 3 without its page-wide typeset pass", async () => {
    render(<MathJaxProvider enableMathRendering>article</MathJaxProvider>)
    expect(await screen.findByTestId("mathjax-context")).toHaveTextContent("article")
    expect(contextProps).toHaveBeenCalledWith({
      version: 3,
      config: { startup: { typeset: false } },
    })
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it("reports a failed script load to Sentry once, as a warning", async () => {
    const error = new Error("script blocked")
    loadError.current = error
    render(<MathJaxProvider enableMathRendering>article</MathJaxProvider>)
    await waitFor(() => expect(captureMessage).toHaveBeenCalledTimes(1))
    expect(captureMessage).toHaveBeenCalledWith("MathJax failed to load", {
      level: "warning",
      extra: { error },
    })
  })
})
