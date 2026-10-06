import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ClientThemeProvider, useTheme } from "@wrksz/themes/client"
import { useEffect } from "react"
import { useGlobals } from "storybook/preview-api"
import { expect, screen, userEvent, waitFor, within } from "storybook/test"

import { ModeToggle, type Theme } from "./ModeToggle"

/** Keeps the toggle's theme and the toolbar's theme switch in step, whichever one changes. */
function FollowToolbar({
  toolbarTheme,
  setToolbarTheme,
}: {
  toolbarTheme: Theme
  setToolbarTheme: (theme: Theme) => void
}): null {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    if (resolvedTheme && resolvedTheme !== toolbarTheme) setTheme(toolbarTheme)
    // Only a toolbar change should reach the toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolbarTheme])

  useEffect(() => {
    if (resolvedTheme && resolvedTheme !== toolbarTheme) setToolbarTheme(resolvedTheme)
    // Only a toggle change should reach the toolbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme])

  return null
}

const meta = {
  title: "Components/ModeToggle",
  component: ModeToggle,
  // The preview's provider forces the toolbar's theme, which would ignore the
  // toggle. This one lets the toggle switch it, and keeps the toolbar in step.
  parameters: { ownThemeProvider: true },
  decorators: [
    (Story) => {
      const [{ theme }, updateGlobals] = useGlobals()
      const toolbarTheme: Theme = theme || "light"
      return (
        <ClientThemeProvider attribute="class" defaultTheme={toolbarTheme} storage="none">
          <FollowToolbar
            toolbarTheme={toolbarTheme}
            setToolbarTheme={(next) => updateGlobals({ theme: next })}
          />
          <Story />
        </ClientThemeProvider>
      )
    },
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
