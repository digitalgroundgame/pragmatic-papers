import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test"

import { CodeBlock } from "./Component"

const meta = {
  title: "Blocks/Code",
  component: CodeBlock,
  args: {
    blockType: "code",
    language: "typescript",
    code: `export function turnout(ballots: number, registered: number): string {
  if (registered === 0) return "n/a"
  return \`\${((ballots / registered) * 100).toFixed(1)}%\`
}`,
  },
  argTypes: {
    language: { control: "inline-radio", options: ["typescript", "javascript", "css"] },
  },
} satisfies Meta<typeof CodeBlock>

export default meta
type Story = StoryObj<typeof meta>

export const TypeScript: Story = {
  beforeEach: () => {
    const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    return () => writeText.mockRestore()
  },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: /Copy/ })
    await userEvent.click(button)
    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(args.code)
    await waitFor(() => expect(button).toHaveTextContent("Copied!"))
  },
}

export const Css: Story = {
  args: {
    language: "css",
    code: `.payload-richtext h2 {
  margin-top: 2.25rem;
  font-family: var(--font-display);
}`,
  },
}
