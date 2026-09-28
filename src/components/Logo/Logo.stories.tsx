import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { Logo } from "."

const meta = {
  title: "Components/Logo",
  component: Logo,
  args: { size: "default" },
  argTypes: { size: { control: "inline-radio", options: ["default", "sm", "xs"] } },
} satisfies Meta<typeof Logo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      {(["default", "sm", "xs"] as const).map((size) => (
        <Logo key={size} size={size} />
      ))}
    </div>
  ),
}
