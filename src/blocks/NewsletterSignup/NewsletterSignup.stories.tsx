import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, userEvent, within } from "storybook/test"

import {
  createLinkNode,
  createParagraph,
  createTextNode,
  richText,
} from "@/stories/fixtures/richText"

import { NewsletterSignupBlock } from "./Component"

function respondWith(status: number, body: object) {
  return () => {
    const fetchSpy = spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), { status }),
    )
    return () => fetchSpy.mockRestore()
  }
}

async function subscribe(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement)
  await userEvent.type(canvas.getByLabelText("Email address"), "reader@example.com")
  await userEvent.click(canvas.getByRole("button", { name: "Sign Up" }))
}

const meta = {
  title: "Blocks/NewsletterSignup",
  component: NewsletterSignupBlock,
  args: {
    blockType: "newsletterSignup",
    heading: "Get Daily Pragmatic Papers",
    description: "One article a day, straight to your inbox.",
    notice: richText(
      createParagraph([
        createTextNode("By subscribing you agree to our "),
        createLinkNode("privacy policy", "/privacy"),
        createTextNode("."),
      ]),
    ),
  },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NewsletterSignupBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Subscribed: Story = {
  beforeEach: respondWith(200, {}),
  play: async ({ canvasElement }) => {
    await subscribe(canvasElement)
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Check your inbox/)).toBeInTheDocument()
    await expect(canvas.getByLabelText("Email address")).toBeDisabled()
    await expect(window.fetch).toHaveBeenCalledWith("/api/newsletter/subscribe", expect.anything())
  },
}

export const Rejected: Story = {
  beforeEach: respondWith(400, { error: "That email address looks invalid." }),
  play: async ({ canvasElement }) => {
    await subscribe(canvasElement)
    const alert = await within(canvasElement).findByRole("alert")
    await expect(alert).toHaveTextContent("That email address looks invalid.")
  },
}

export const Defaults: Story = {
  args: { heading: null, description: null, buttonLabel: null, notice: null },
}
