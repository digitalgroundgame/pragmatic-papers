import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import React, { useState } from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { Button } from "@/components/ui/button"

import { LoadOnInteraction } from "."

/** The "interactive" component: it counts presses, which the placeholder can't. */
function Counter({ label }: { label: string }): React.ReactNode {
  const [count, setCount] = useState(0)
  return (
    <Button variant="outline" onClick={() => setCount(count + 1)}>
      {label}: {count}
    </Button>
  )
}

// Stands in for a chunk on a slow network, so the first click lands before it arrives.
const load = () => new Promise<typeof Counter>((resolve) => setTimeout(() => resolve(Counter), 400))

const meta = {
  title: "Components/LoadOnInteraction",
  component: LoadOnInteraction<{ label: string }>,
  args: {
    load,
    props: { label: "Presses" },
    children: <Button variant="outline">Presses: 0</Button>,
  },
} satisfies Meta<typeof LoadOnInteraction<{ label: string }>>

export default meta
type Story = StoryObj<typeof meta>

/** The click that starts the load counts, once the component is in. */
export const FirstClickCounts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Presses: 0" }))
    await expect(await canvas.findByRole("button", { name: "Presses: 1" })).toHaveFocus()
  },
}

/** Focus by keyboard loads it too, and stays on the button through the swap. */
export const KeyboardFocusCarriesOver: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const placeholder = canvas.getByRole("button", { name: "Presses: 0" })
    await userEvent.tab()
    await expect(placeholder).toHaveFocus()
    await waitFor(() => expect(placeholder).not.toBeInTheDocument())
    const button = canvas.getByRole("button", { name: "Presses: 0" })
    await expect(button).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(button).toHaveTextContent("Presses: 1")
  },
}
