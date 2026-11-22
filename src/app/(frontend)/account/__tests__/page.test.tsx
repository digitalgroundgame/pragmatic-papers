import { cleanup, render, screen, within } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BetaFeaturesProvider } from "@/components/BetaBadge"
import type { BetaFeatures } from "@/data/betaFeatures"

const { switches } = vi.hoisted(() => ({ switches: { sso: true } }))
vi.mock("@/globals/Plugins/isPluginEnabled", () => ({
  isPluginEnabled: async (name: keyof typeof switches) => switches[name],
}))
vi.mock("@/plugins/signIn", () => ({ signUpProviders: () => [] }))
vi.mock("@/components/Account", () => ({ Account: () => null }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound")
  },
}))

import AccountPage from "../page"

const renderPage = async (features: BetaFeatures) =>
  render(
    <BetaFeaturesProvider features={features}>
      {(await AccountPage()) as React.ReactElement}
    </BetaFeaturesProvider>,
  )

const heading = () => screen.getByRole("heading", { level: 1, name: "Your account" })

describe("AccountPage", () => {
  beforeEach(() => {
    switches.sso = true
  })
  afterEach(cleanup)

  it("puts a flask beside its heading while accounts are a beta", async () => {
    await renderPage({ sso: "Accounts are in beta." })
    expect(
      within(heading()).getByRole("button", { name: "Beta feature" }),
    ).toHaveAccessibleDescription("Accounts are in beta.")
  })

  it("drops the flask once accounts graduate", async () => {
    await renderPage({})
    expect(
      within(heading()).queryByRole("button", { name: "Beta feature" }),
    ).not.toBeInTheDocument()
  })

  it("is not found while single sign-on is off", async () => {
    switches.sso = false
    await expect(AccountPage()).rejects.toThrow("notFound")
  })
})
