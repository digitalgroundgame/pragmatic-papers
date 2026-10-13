import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { LinkedAccountsPanel } from "./LinkedAccountsPanel"

const meta = {
  title: "Admin/Account/LinkedAccountsPanel",
  component: LinkedAccountsPanel,
  decorators: [withPayloadAdminTheme],
  args: {
    providers: [
      { id: "google", label: "Google", linked: true },
      { id: "discord", label: "Discord", linked: false },
      { id: "destinygg", label: "Destiny.gg", linked: false },
    ],
    pending: null,
    error: null,
    onConnect: fn(),
    onDisconnect: fn(),
  },
} satisfies Meta<typeof LinkedAccountsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "Disconnect Google" })).toBeEnabled()
    canvas.getByRole("button", { name: "Connect Destiny.gg" }).click()
    await expect(args.onConnect).toHaveBeenCalledWith("destinygg")
  },
}

/** Connecting: every button waits for the provider's redirect. */
export const Pending: Story = {
  args: { pending: "destinygg" },
  play: async ({ canvasElement }) => {
    for (const button of within(canvasElement).getAllByRole("button")) {
      await expect(button).toBeDisabled()
    }
  },
}

/** Back from a provider whose account is linked to someone else. */
export const AlreadyLinked: Story = {
  args: { error: "account_already_linked_to_different_user" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "already linked to someone else",
    )
  },
}
