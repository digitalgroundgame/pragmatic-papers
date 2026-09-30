import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test"

import type { Form } from "@/payload-types"
import { createHeadingNode, createParagraph, richText } from "@/stories/fixtures/richText"

import { FormBlock } from "./Component"

const form = {
  id: 7,
  title: "Contact us",
  submitButtonLabel: "Send it",
  confirmationType: "message",
  confirmationMessage: richText(createParagraph("Thanks — an editor will reply within two days.")),
  fields: [
    { blockType: "text", name: "name", label: "Name", required: true, width: 50 },
    { blockType: "email", name: "email", label: "Email", required: true, width: 50 },
    {
      blockType: "message",
      message: richText(createParagraph("Pitches go to the editors; everything else to the desk.")),
    },
    {
      blockType: "select",
      name: "topic",
      label: "Topic",
      options: [
        { label: "Pitch an article", value: "pitch" },
        { label: "Correction", value: "correction" },
      ],
    },
    { blockType: "textarea", name: "message", label: "Message", required: true },
    { blockType: "checkbox", name: "subscribe", label: "Also send me the newsletter" },
  ],
  createdAt: "2026-01-15T12:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
} as Form

const meta = {
  title: "Blocks/Form",
  component: FormBlock,
  parameters: { layout: "fullscreen" },
  args: {
    blockType: "formBlock",
    form,
    enableIntro: true,
    introContent: richText(
      createHeadingNode("Write to the editors", "h2"),
      createParagraph("Corrections, pitches, and questions are all welcome."),
    ),
  },
  beforeEach: () => {
    const fetchSpy = spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ doc: { id: 1 } }), { status: 201 }),
    )
    return () => fetchSpy.mockRestore()
  },
} satisfies Meta<typeof FormBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// #999: the error isn't tied to its input (no aria-invalid / aria-describedby)
// and its red falls short of AA.
export const RequiredFields: Story = {
  parameters: { a11y: { test: "todo" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Send it" }))
    await waitFor(() => expect(canvas.getAllByText("This field is required")).toHaveLength(3))
    await expect(window.fetch).not.toHaveBeenCalled()
  },
}

export const Submitted: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText(/^Name/), "Ada Lovelace")
    await userEvent.type(canvas.getByLabelText(/^Email/), "ada@example.com")
    await userEvent.click(canvas.getByRole("combobox", { name: /Topic/ }))
    await userEvent.click(await screen.findByRole("option", { name: "Correction" }))
    // The listbox stays mounted while it animates out; let it go before the axe check runs.
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
    await userEvent.type(canvas.getByLabelText(/^Message/), "The 2022 turnout figure is off.")
    await userEvent.click(canvas.getByRole("button", { name: "Send it" }))
    await expect(await canvas.findByText(/an editor will reply/)).toBeInTheDocument()
    await expect(window.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/form-submissions"),
      expect.objectContaining({ method: "POST" }),
    )
  },
}
