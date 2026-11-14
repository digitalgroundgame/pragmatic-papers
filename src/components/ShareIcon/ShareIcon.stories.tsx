import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn } from "storybook/test"

import { ShareIcon } from "."

const meta = {
  title: "Components/ShareIcon",
  component: ShareIcon,
  parameters: { layout: "centered" },
  args: { "aria-hidden": true },
} satisfies Meta<typeof ShareIcon>

export default meta
type Story = StoryObj<typeof meta>

const onPlatform = (platform: string) => () => {
  const spies = [
    spyOn(navigator, "platform", "get").mockReturnValue(platform),
    spyOn(navigator, "userAgent", "get").mockReturnValue(platform),
  ]
  if ("userAgentData" in navigator) {
    spies.push(
      spyOn(navigator, "userAgentData" as never, "get").mockReturnValue(undefined as never),
    )
  }
  return () => spies.forEach((spy) => spy.mockRestore())
}

/** On a Mac, iPhone or iPad: Apple's box with an arrow. */
export const Apple: Story = {
  beforeEach: onPlatform("MacIntel"),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg")).toHaveClass("lucide-share")
  },
}

/** Everywhere else: the three joined dots. */
export const Elsewhere: Story = {
  beforeEach: onPlatform("Win32"),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg")).toHaveClass("lucide-share-2")
  },
}
