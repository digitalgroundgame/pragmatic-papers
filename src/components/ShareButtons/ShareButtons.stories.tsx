import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test"

import { ShareButtons } from "."

const meta = {
  title: "Components/ShareButtons",
  component: ShareButtons,
  parameters: { layout: "centered" },
  args: {
    url: "https://pragmaticpapers.com/articles/school-board-races",
    title: "The school board races nobody is watching",
  },
  beforeEach: () => {
    const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    return () => writeText.mockRestore()
  },
} satisfies Meta<typeof ShareButtons>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Share" }))
    const dialog = await screen.findByRole("dialog", { name: "Share" })
    await expect(within(dialog).getByRole("textbox", { name: "Link to share" })).toHaveValue(
      args.url,
    )
    await expect(within(dialog).getByRole("link", { name: "Share on Bluesky" })).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent(args.url)),
    )

    await userEvent.click(within(dialog).getByRole("button", { name: "Copy link" }))
    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(args.url)
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Copied!" })).toBeInTheDocument(),
    )
  },
}
