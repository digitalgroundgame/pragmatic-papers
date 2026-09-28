import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion"

const faqs = [
  {
    question: "Who writes for The Pragmatic Papers?",
    answer: "Volunteer writers from the community, edited by our editorial team.",
  },
  {
    question: "How often do new volumes come out?",
    answer: "A new volume is published every week, collecting that week's articles.",
  },
  {
    question: "Can I submit an article?",
    answer: "Yes — reach out through the contact form and an editor will follow up.",
  },
]

const meta = {
  title: "UI/Accordion",
  component: Accordion,
  render: (args) => (
    <Accordion className="max-w-lg" {...args}>
      {faqs.map((faq) => (
        <AccordionItem key={faq.question} value={faq.question}>
          <AccordionTrigger>{faq.question}</AccordionTrigger>
          <AccordionContent>{faq.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
} satisfies Meta<typeof Accordion>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: faqs[0]!.question })
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await waitFor(() => expect(canvas.getByText(faqs[0]!.answer)).toBeVisible())
  },
}

export const OpenByDefault: Story = {
  args: { defaultValue: [faqs[1]!.question] },
}

export const Multiple: Story = {
  args: { multiple: true, defaultValue: [faqs[0]!.question, faqs[2]!.question] },
}
