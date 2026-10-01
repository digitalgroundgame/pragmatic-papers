import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test"

import { FeedHTML } from "@/stories/FeedHTML"
import { codeBlock } from "@/stories/fixtures/blocks"

import { CodeBlock } from "./Component"
import { codeToHTML } from "./converters"

const meta = {
  title: "Blocks/Code",
  component: CodeBlock,
  args: codeBlock,
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

/** The code in the RSS and Substack feeds: escaped, in a plain `<pre><code>`. */
export const Feed: Story = {
  render: (args) => <FeedHTML html={codeToHTML(args)} />,
  play: async ({ args, canvasElement }) => {
    // Escaped on the way out, so the browser reads back exactly the source.
    await expect(canvasElement.querySelector("pre code")?.textContent).toBe(args.code)
  },
}
