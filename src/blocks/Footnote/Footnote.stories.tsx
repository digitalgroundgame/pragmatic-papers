import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { knownContrastIssue } from "@/stories/a11y"

import { FootnoteBlock } from "./Component"

const meta = {
  title: "Blocks/Footnote",
  component: FootnoteBlock,
  parameters: knownContrastIssue,
  args: {
    blockType: "footnote",
    index: 3,
    note: "Turnout figures are from the county clerk's certified results.",
  },
  render: (args) => (
    <>
      <p className="max-w-prose font-serif text-lg">
        Only 11 percent of registered voters cast a ballot
        <FootnoteBlock {...args} /> in the special election.
      </p>
      <ol className="mt-8 text-sm">
        <li id={`footnote-${args.index}`} value={args.index ?? undefined}>
          {args.note}
        </li>
      </ol>
    </>
  ),
} satisfies Meta<typeof FootnoteBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const link = within(canvasElement).getByRole("link", { name: `[${args.index}]` })
    await expect(link).toHaveAttribute("href", `#footnote-${args.index}`)
    await expect(link).toHaveAccessibleDescription(args.note!)
  },
}
