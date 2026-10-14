import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/** A card, button, badge, avatar and an inline-styled box: each rounds its corners its own way. */
const Sampler = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Volume XII</CardTitle>
    </CardHeader>
    <CardContent className="flex items-center gap-3">
      <Button>Read volume</Button>
      <Badge>New</Badge>
      <Avatar>
        <AvatarFallback>JA</AvatarFallback>
      </Avatar>
      <div data-testid="inline" style={{ borderRadius: 12 }} className="bg-muted size-8" />
    </CardContent>
  </Card>
)

const corners = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  return [
    canvasElement.querySelector<HTMLElement>("[data-slot=card]")!,
    canvas.getByRole("button", { name: "Read volume" }),
    canvas.getByText("New"),
    canvasElement.querySelector<HTMLElement>("[data-slot=avatar]")!,
    canvas.getByTestId("inline"),
  ].map((el) => getComputedStyle(el).borderTopLeftRadius)
}

/** The squareCorners experiment: the layout marks `<html>` and globals.css squares every corner. */
const meta = {
  title: "Experiments/Square corners",
  component: Sampler,
} satisfies Meta<typeof Sampler>

export default meta
type Story = StoryObj<typeof meta>

export const Rounded: Story = {
  play: async ({ canvasElement }) => {
    for (const radius of corners(canvasElement)) await expect(radius).not.toBe("0px")
  },
}

export const Square: Story = {
  beforeEach: () => {
    document.documentElement.dataset.corners = "square"
    return () => {
      delete document.documentElement.dataset.corners
    }
  },
  play: async ({ canvasElement }) => {
    for (const radius of corners(canvasElement)) await expect(radius).toBe("0px")
  },
}
