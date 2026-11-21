import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { AvatarChain } from "./AvatarChain"

const meta = {
  title: "Admin/AdminAvatar",
  component: AvatarChain,
  decorators: [withPayloadAdminTheme],
  args: { initials: "AL", sources: [] },
} satisfies Meta<typeof AvatarChain>

export default meta
type Story = StoryObj<typeof meta>

/** The first picture that loads. */
export const Picture: Story = {
  args: { sources: ["/storybook-assets/square.svg"] },
}

/** No picture loads, so the initials show. */
export const Initials: Story = {
  args: { sources: ["/does-not-exist.png"] },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("AL")).toBeInTheDocument()
  },
}
