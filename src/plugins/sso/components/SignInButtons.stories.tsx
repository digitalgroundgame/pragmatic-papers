import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { SignInButtons } from "./SignInButtons"

const meta = {
  title: "Admin/Login/SignInButtons",
  component: SignInButtons,
  decorators: [withPayloadAdminTheme],
  args: {
    providers: ["google", "discord"],
    authPath: "/api/auth",
    adminPath: "/admin",
  },
} satisfies Meta<typeof SignInButtons>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "Sign in with Google" })).toBeEnabled()
    await expect(canvas.getByRole("button", { name: "Sign in with Discord" })).toBeEnabled()
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument()
  },
}

export const OneProvider: Story = {
  args: { providers: ["discord"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("button")).toHaveLength(1)
  },
}

/** Back from a provider with an address no account here uses. */
export const NoAccount: Story = {
  parameters: { nextjs: { navigation: { query: { error: "signup_disabled" } } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "No account here uses that address",
    )
  },
}

/** An error code this page has no wording for. */
export const UnknownError: Story = {
  parameters: { nextjs: { navigation: { query: { error: "state_mismatch" } } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "Sign-in didn't complete",
    )
  },
}
