import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import { Button } from "./button"
import {
  TooltipPopup,
  TooltipPortal,
  TooltipPositioner,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "./tooltip"

const meta = {
  title: "UI/Tooltip",
  component: TooltipRoot,
  render: (args) => (
    <TooltipProvider delay={0}>
      <TooltipRoot {...args}>
        <TooltipTrigger render={<Button variant="outline" />}>Share</TooltipTrigger>
        <TooltipPortal>
          <TooltipPositioner>
            <TooltipPopup>Copy a link to this article</TooltipPopup>
          </TooltipPositioner>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  ),
} satisfies Meta<typeof TooltipRoot>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("button", { name: "Share" }))
    await expect(await screen.findByText("Copy a link to this article")).toBeInTheDocument()
  },
}

export const Open: Story = {
  args: { defaultOpen: true },
}
