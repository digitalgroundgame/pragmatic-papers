import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, mocked, within } from "storybook/test"

import { authors } from "@/stories/fixtures/docs"
import { createFakePayload } from "@/stories/fixtures/payload"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { ContributorsBlock } from "./Component"

const meta = {
  title: "Blocks/Contributors",
  component: ContributorsBlock,
  parameters: { layout: "fullscreen" },
  args: {
    blockType: "contributors",
    title: "Contributors",
    people: authors.map((author) => author.id),
  },
  beforeEach: () => {
    mocked(getPayloadConfig).mockResolvedValue(
      createFakePayload({ collections: { users: authors } }),
    )
  },
} satisfies Meta<typeof ContributorsBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const section = await within(canvasElement).findByRole("region", { name: "Contributors" })
    await expect(within(section).getByText("Jordan Rivera")).toBeInTheDocument()
  },
}

export const KeepsEditorOrder: Story = {
  args: { title: "Edited by", people: [3, 1] },
  play: async ({ canvasElement }) => {
    const section = await within(canvasElement).findByRole("region", { name: "Edited by" })
    const text = section.textContent ?? ""
    await expect(text.indexOf("Priya Natarajan")).toBeLessThan(text.indexOf("Jordan Rivera"))
  },
}
