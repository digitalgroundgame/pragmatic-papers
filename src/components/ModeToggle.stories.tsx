import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ClientThemeProvider } from "@wrksz/themes/client"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { ModeToggle } from "./ModeToggle"

const meta = {
  title: "Components/ModeToggle",
  component: ModeToggle,
  // The preview's provider forces the toolbar's theme, which would ignore the toggle.
  parameters: { ownThemeProvider: true },
  decorators: [
    (Story) => (
      <ClientThemeProvider attribute="class" defaultTheme="light" storage="none">
        <Story />
      </ClientThemeProvider>
    ),
  ],
} satisfies Meta<typeof ModeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Toggle theme" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Dark" }))
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"))

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Toggle theme" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Light" }))
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"))
    // The menu stays mounted while it animates out; let it go before the axe check runs.
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  },
}
