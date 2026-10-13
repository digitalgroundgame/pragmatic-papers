import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  LinkedAccountsPanel,
  type LinkedAccountsPanelProps,
} from "../components/LinkedAccountsPanel"

const providers: LinkedAccountsPanelProps["providers"] = [
  { id: "discord", label: "Discord", linked: true },
  { id: "destiny", label: "Destiny.gg", linked: false },
]

const renderPanel = (props: Partial<LinkedAccountsPanelProps> = {}) => {
  const onConnect = vi.fn()
  const onDisconnect = vi.fn()
  render(
    <LinkedAccountsPanel
      providers={providers}
      pending={null}
      error={null}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      {...props}
    />,
  )
  return { onConnect, onDisconnect }
}

describe("LinkedAccountsPanel", () => {
  it("offers Disconnect for a linked account and Connect for the rest", () => {
    const { onConnect, onDisconnect } = renderPanel()

    fireEvent.click(screen.getByRole("button", { name: "Disconnect Discord" }))
    fireEvent.click(screen.getByRole("button", { name: "Connect Destiny.gg" }))

    expect(onDisconnect).toHaveBeenCalledWith("discord")
    expect(onConnect).toHaveBeenCalledWith("destiny")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("holds every button while a request is in flight", () => {
    renderPanel({ pending: "destiny" })
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled()
    expect(screen.getByRole("button", { name: "Connect Destiny.gg" })).toHaveTextContent("…")
  })

  it.each([
    ["account_already_linked_to_different_user", "already linked to someone else"],
    ["unable_to_link_account", "wouldn't let the account be linked"],
    ["request_failed", "Linking didn't complete"],
  ])("explains %s", (error, message) => {
    renderPanel({ error })
    expect(screen.getByRole("alert")).toHaveTextContent(message)
  })
})
