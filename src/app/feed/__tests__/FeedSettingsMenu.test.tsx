import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FeedSettingsMenu } from "../FeedSettingsMenu"

describe("FeedSettingsMenu", () => {
  it("offers a way back home", async () => {
    render(<FeedSettingsMenu />)
    fireEvent.click(screen.getByRole("button", { name: "Open feed menu" }))
    expect(await screen.findByRole("menuitem", { name: "Home" })).toHaveAttribute("href", "/")
  })
})
