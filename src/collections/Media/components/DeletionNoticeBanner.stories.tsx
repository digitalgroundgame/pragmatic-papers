import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { DeletionNoticeBanner } from "./DeletionNoticeBanner"

const meta = {
  title: "Admin/Media/DeletionNoticeBanner",
  component: DeletionNoticeBanner,
  decorators: [withPayloadAdminTheme],
  args: { count: 1 },
} satisfies Meta<typeof DeletionNoticeBanner>

export default meta
type Story = StoryObj<typeof meta>

export const UsedOnce: Story = {
  play: async ({ canvasElement }) => {
    const notice = within(canvasElement).getByRole("status")
    await expect(notice).toHaveTextContent("Can't be deleted while in use")
    await expect(notice).toHaveTextContent("Used in 1 published document,")
  },
}

export const UsedSeveralTimes: Story = {
  args: { count: 3 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Used in 3 published documents,",
    )
  },
}

export const Unused: Story = {
  args: { count: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("status")).not.toBeInTheDocument()
  },
}
