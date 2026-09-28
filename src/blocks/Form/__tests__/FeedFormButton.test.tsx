import { FeedShellContext } from "@/app/(feed)/feed/FeedShellContext"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FeedFormButton } from "../FeedFormButton"

function renderButton() {
  const pauseAutoPlay = vi.fn()
  const resumeAutoPlay = vi.fn()
  render(
    <FeedShellContext.Provider value={{ pauseAutoPlay, resumeAutoPlay }}>
      <FeedFormButton triggerLabel="Join the list">
        <form aria-label="Signup" />
      </FeedFormButton>
    </FeedShellContext.Provider>,
  )
  return { pauseAutoPlay, resumeAutoPlay }
}

describe("FeedFormButton", () => {
  it("shows the form's title and keeps the form closed", () => {
    renderButton()
    expect(screen.getByText("Join the list")).toBeInTheDocument()
    expect(screen.queryByRole("form", { name: "Signup" })).not.toBeInTheDocument()
  })

  it("opens the server-rendered form and pauses auto-play until it closes", async () => {
    const { pauseAutoPlay, resumeAutoPlay } = renderButton()

    fireEvent.click(screen.getByRole("button", { name: "Open form" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("Join the list")
    expect(screen.getByRole("form", { name: "Signup" })).toBeInTheDocument()
    expect(pauseAutoPlay).toHaveBeenCalledOnce()
    expect(resumeAutoPlay).not.toHaveBeenCalled()

    fireEvent.keyDown(dialog, { key: "Escape" })
    await vi.waitFor(() => expect(resumeAutoPlay).toHaveBeenCalledOnce())
  })
})
