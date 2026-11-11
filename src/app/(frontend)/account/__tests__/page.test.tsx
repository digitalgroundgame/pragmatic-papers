import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { switches, betas, account } = vi.hoisted(() => ({
  switches: { sso: true },
  betas: { sso: true, achievements: true },
  account: vi.fn(),
}))
vi.mock("@/globals/Plugins/isPluginEnabled", () => ({
  isPluginEnabled: async (name: keyof typeof switches) => switches[name],
}))
vi.mock("@/globals/Plugins/isPluginBeta", () => ({
  isPluginBeta: async (name: keyof typeof betas) => betas[name],
}))
vi.mock("@/plugins/signIn", () => ({ signUpProviders: () => [] }))
vi.mock("@/components/Account", () => ({
  Account: (props: { achievementsBeta?: boolean }) => {
    account(props)
    return null
  },
}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound")
  },
}))

import AccountPage from "../page"

const renderPage = async () => render((await AccountPage()) as React.ReactElement)

describe("AccountPage", () => {
  beforeEach(() => {
    switches.sso = true
    betas.sso = true
    betas.achievements = true
    account.mockClear()
  })
  afterEach(cleanup)

  it("badges the page and its achievements while their plugins are betas", async () => {
    await renderPage()
    expect(
      screen.getByRole("heading", { level: 1, name: /^Your account\s*Beta$/ }),
    ).toBeInTheDocument()
    expect(account).toHaveBeenCalledWith(expect.objectContaining({ achievementsBeta: true }))
  })

  it("drops the badges once the plugins graduate", async () => {
    betas.sso = false
    betas.achievements = false
    await renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Your account" })).toBeInTheDocument()
    expect(screen.queryByText("Beta")).not.toBeInTheDocument()
    expect(account).toHaveBeenCalledWith(expect.objectContaining({ achievementsBeta: false }))
  })

  it("is not found while single sign-on is off", async () => {
    switches.sso = false
    await expect(AccountPage()).rejects.toThrow("notFound")
  })
})
