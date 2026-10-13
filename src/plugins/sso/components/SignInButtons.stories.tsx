import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { SignInButtons } from "./SignInButtons"

const meta = {
  title: "Admin/Login/SignInButtons",
  component: SignInButtons,
  decorators: [withPayloadAdminTheme],
  args: {
    providers: ["google", "discord", "destiny"],
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
    await expect(canvas.getByRole("button", { name: "Sign in with Destiny.gg" })).toBeEnabled()
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument()
  },
}

/** In the admin's dark theme, where Google's button switches to its dark variant. */
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div
        data-theme="dark"
        // Payload's dark theme inverts its elevation scale; Storybook has no admin styles.
        style={
          {
            background: "rgb(20, 20, 20)",
            color: "rgb(235, 235, 235)",
            padding: "1rem",
            "--theme-elevation-200": "rgb(60, 60, 60)",
            "--theme-elevation-650": "rgb(166, 166, 166)",
          } as React.CSSProperties
        }
      >
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "Sign in with Google" })).toBeEnabled()
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
      "No account here matches that sign-in",
    )
  },
}

/** Back from Destiny.gg, which shares no address, with an account nobody here has linked. */
export const NoLinkedAccount: Story = {
  parameters: { nextjs: { navigation: { query: { error: "email_not_found" } } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "That account isn't linked to anyone here",
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
