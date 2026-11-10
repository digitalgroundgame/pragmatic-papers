import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Info, TriangleAlert } from "lucide-react"
import { expect, within } from "storybook/test"

import { Alert, AlertDescription, AlertTitle } from "./alert"

const meta = {
  title: "UI/Alert",
  component: Alert,
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Alert>
      <Info aria-hidden />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Something worth knowing before you go on.</AlertDescription>
    </Alert>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("note")).toHaveTextContent("Heads up")
  },
}

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>That didn&apos;t work</AlertTitle>
      <AlertDescription>Try again in a moment.</AlertDescription>
    </Alert>
  ),
}
