import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { ProviderSignInButton } from "."

const meta = {
  title: "Components/ProviderSignInButton",
  component: ProviderSignInButton,
  args: { provider: "google", label: "Google", onClick: fn() },
} satisfies Meta<typeof ProviderSignInButton>

export default meta
type Story = StoryObj<typeof meta>

export const Google: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Sign in with Google" }),
    )
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}

export const Discord: Story = { args: { provider: "discord", label: "Discord" } }

export const Destiny: Story = { args: { provider: "destiny", label: "Destiny.gg" } }

/** A provider without its own look gets the plain outline button. */
export const Other: Story = { args: { provider: "github", label: "GitHub" } }

/** Every provider, one above the other at one width, as the account page shows them. */
export const All: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <ProviderSignInButton {...args} provider="destiny" label="Destiny.gg" />
      <ProviderSignInButton {...args} provider="google" label="Google" />
      <ProviderSignInButton {...args} provider="discord" label="Discord" />
    </div>
  ),
}

/** Logos only, in a row, as the comment box shows them. */
export const IconOnly: Story = {
  args: { iconOnly: true },
  render: (args) => (
    <div className="flex gap-2">
      <ProviderSignInButton {...args} provider="destiny" label="Destiny.gg" />
      <ProviderSignInButton {...args} provider="google" label="Google" />
      <ProviderSignInButton {...args} provider="discord" label="Discord" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "Sign in with Destiny.gg" })).toHaveAttribute(
      "title",
      "Sign in with Destiny.gg",
    )
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button")).toBeDisabled()
  },
}
