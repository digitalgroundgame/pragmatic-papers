import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import { Dot } from "./dot"

const tones = ["brand", "primary", "muted"] as const

const meta = {
  title: "UI/Dot",
  component: Dot,
  argTypes: {
    size: { control: "select", options: ["sm", "md"] },
    shape: { control: "select", options: ["round", "square"] },
    tone: { control: "select", options: [...tones, "none"] },
    ring: { control: "boolean" },
  },
} satisfies Meta<typeof Dot>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-slot='dot']")).toBeVisible()
  },
}

/** Every tone, in both sizes and shapes. */
export const Variants: Story = {
  render: (args) => (
    <div className="grid w-fit grid-cols-3 gap-4">
      {(["sm", "md"] as const).flatMap((size) =>
        (["round", "square"] as const).flatMap((shape) =>
          tones.map((tone) => (
            <Dot key={`${size}-${shape}-${tone}`} {...args} size={size} shape={shape} tone={tone} />
          )),
        ),
      )}
    </div>
  ),
}

/** A background-coloured ring stands the dot off whatever it sits on, like an icon. */
export const Ring: Story = {
  args: { ring: true },
  render: (args) => (
    <div className="bg-muted relative size-10 rounded-md">
      <Dot {...args} className="absolute top-0.5 right-0.5" />
    </div>
  ),
}

/** A legend swatch: no tone, the colour comes from data. */
export const Swatch: Story = {
  render: () => (
    <p className="flex items-center gap-1.5 text-sm">
      <Dot size="md" tone="none" style={{ background: "#2563eb" }} />
      Appointed by a Democrat
    </p>
  ),
}

/** Rendered as a button, as the carousel's position indicators are, with its own label. */
export const AsButton: Story = {
  render: () => (
    <Dot
      shape="square"
      tone="primary"
      ring
      render={<button type="button" aria-label="Go to slide 1" />}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Go to slide 1" })).toBeVisible()
  },
}
