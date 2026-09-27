import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { createHeadingNode, createParagraph, richText } from "@/stories/fixtures/richText"
import { landscapeImage, wideImage } from "@/stories/fixtures/media"

import { RenderHero } from "./RenderHero"

const heroText = richText(
  createHeadingNode("The offices that shape daily life", "h1"),
  createParagraph("A week of reporting on school boards, county commissions, and city councils."),
)

const links = [
  {
    link: {
      type: "custom" as const,
      url: "/volumes/12",
      label: "Read the volume",
      appearance: "default" as const,
    },
  },
  {
    link: {
      type: "custom" as const,
      url: "/about",
      label: "About us",
      appearance: "outline" as const,
    },
  },
]

const meta = {
  title: "Heros/RenderHero",
  component: RenderHero,
  parameters: { layout: "fullscreen" },
  args: { type: "lowImpact", richText: heroText },
  argTypes: {
    type: {
      control: "inline-radio",
      options: ["highImpact", "mediumImpact", "lowImpact", "pageHero"],
    },
  },
  decorators: [
    (Story) => (
      <div className="py-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RenderHero>

export default meta
type Story = StoryObj<typeof meta>

export const HighImpact: Story = {
  args: { type: "highImpact", media: landscapeImage, links },
  decorators: [
    (Story) => (
      <div className="pt-[10.4rem]">
        <Story />
      </div>
    ),
  ],
}

export const MediumImpact: Story = {
  args: { type: "mediumImpact", media: wideImage, links },
}

export const LowImpact: Story = {}

export const PageHero: Story = {
  args: { type: "pageHero" },
}
