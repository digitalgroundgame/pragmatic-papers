import { render, screen } from "@testing-library/react"
import type { Payload } from "payload"
import type React from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("../TourProvider", () => ({
  TourProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tours">{children}</div>
  ),
}))

import { TourGate } from "../TourGate"

const payloadWith = (enabled?: () => Promise<boolean>) =>
  ({ config: { custom: { tours: { enabled } } } }) as unknown as Payload

const renderGate = async (payload: Payload) =>
  render((await TourGate({ children: <p>Admin</p>, payload })) as React.ReactElement)

describe("TourGate", () => {
  it("mounts the tours while switched on, or when nothing switches them", async () => {
    for (const payload of [
      payloadWith(async () => true),
      payloadWith(),
      {
        config: {},
      } as unknown as Payload,
    ]) {
      const { unmount } = await renderGate(payload)
      expect(screen.getByTestId("tours")).toHaveTextContent("Admin")
      unmount()
    }
  })

  it("renders the admin alone while switched off", async () => {
    await renderGate(payloadWith(async () => false))
    expect(screen.queryByTestId("tours")).not.toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
  })
})
