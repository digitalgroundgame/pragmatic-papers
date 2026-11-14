import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

const { drawWhipCountSVG, map } = vi.hoisted(() => ({
  drawWhipCountSVG: vi.fn(() => "<svg/>"),
  map: {
    themePalette: vi.fn(() => ({ background: "#000", ink: "#fff", quietInk: "#aaa" })),
    logoMarkup: vi.fn(() => "<svg logo/>"),
    fontFaces: vi.fn(async () => "@font-face{}"),
    saveSVGAsPNG: vi.fn(async () => undefined),
    mapFileName: (title: string) =>
      title ? `${title.toLowerCase().replace(/\W+/g, "-")}.png` : "map.png",
  },
}))
vi.mock("../picture", () => ({ drawWhipCountSVG }))
vi.mock("@/blocks/InteractiveMap/download/downloadMapImage", () => map)

import { DownloadWhipCountButton } from "../WhipCountDownload"

describe("DownloadWhipCountButton", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it("draws the count in the page's theme with its logo, and saves it under the title", async () => {
    render(
      <div data-whip-count="">
        <DownloadWhipCountButton title="Who leads" data={whipCountData} />
        <span data-whip-count-logo="">
          <svg data-testid="logo" />
        </span>
      </div>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }))
    await waitFor(() => expect(map.saveSVGAsPNG).toHaveBeenCalledWith("<svg/>", "who-leads.png"))

    const logo = screen.getByTestId("logo")
    expect(map.themePalette).toHaveBeenCalledWith(logo)
    expect(map.logoMarkup).toHaveBeenCalledWith(logo, "#fff")
    expect(drawWhipCountSVG).toHaveBeenCalledWith({
      title: "Who leads",
      data: whipCountData,
      palette: { background: "#000", ink: "#fff", quietInk: "#aaa" },
      logo: "<svg logo/>",
      fontFaces: "@font-face{}",
    })
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled())
  })

  it("draws in the light theme, and names an untitled count, when it finds no logo", async () => {
    render(<DownloadWhipCountButton title="" data={whipCountData} />)
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }))
    await waitFor(() => expect(map.saveSVGAsPNG).toHaveBeenCalledWith("<svg/>", "whip-count.png"))
    expect(map.themePalette).not.toHaveBeenCalled()
    expect(map.logoMarkup).toHaveBeenCalledWith(null, "#171717")
    expect(drawWhipCountSVG).toHaveBeenCalledWith(expect.objectContaining({ palette: undefined }))
  })

  it("logs a failure and lets the reader try again", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined)
    map.saveSVGAsPNG.mockRejectedValueOnce(new Error("no canvas"))
    render(<DownloadWhipCountButton title="T" data={whipCountData} />)
    const button = screen.getByRole("button", { name: "Download PNG" })
    fireEvent.click(button)
    await waitFor(() => expect(logged).toHaveBeenCalled())
    await waitFor(() => expect(button).toBeEnabled())
    logged.mockRestore()
  })
})
