import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

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
      variant: "default" as const,
    },
  },
  {
    link: {
      type: "custom" as const,
      url: "/about",
      label: "About us",
      variant: "outline" as const,
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

const expectHeading = async (canvasElement: HTMLElement): Promise<void> => {
  await expect(
    within(canvasElement).getByRole("heading", {
      level: 1,
      name: "The offices that shape daily life",
    }),
  ).toBeInTheDocument()
}

const expectLinks = async (canvasElement: HTMLElement): Promise<void> => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole("link", { name: "Read the volume" })).toHaveAttribute(
    "href",
    "/volumes/12",
  )
  await expect(canvas.getByRole("link", { name: "About us" })).toHaveAttribute("href", "/about")
}

/** The text-only heroes draw no media and no buttons, whatever the document holds. */
const expectTextOnly = async (canvasElement: HTMLElement): Promise<void> => {
  const canvas = within(canvasElement)
  await expect(canvas.queryByRole("img")).not.toBeInTheDocument()
  await expect(canvas.queryByRole("link")).not.toBeInTheDocument()
}

export const HighImpact: Story = {
  args: { type: "highImpact", media: landscapeImage, links },
  play: async ({ canvasElement }) => {
    await expectHeading(canvasElement)
    await expectLinks(canvasElement)
    await expect(
      within(canvasElement).getByRole("img", { name: "Mountains at sunset" }),
    ).toBeInTheDocument()
  },
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
  play: async ({ canvasElement }) => {
    await expectHeading(canvasElement)
    await expectLinks(canvasElement)
    await expect(
      within(canvasElement).getByRole("img", { name: "A city skyline at dusk" }),
    ).toBeInTheDocument()
  },
}

export const LowImpact: Story = {
  args: { media: landscapeImage, links },
  play: async ({ canvasElement }) => {
    await expectHeading(canvasElement)
    await expectTextOnly(canvasElement)
  },
}

export const PageHero: Story = {
  args: { type: "pageHero", media: landscapeImage, links },
  play: async ({ canvasElement }) => {
    await expectHeading(canvasElement)
    await expectTextOnly(canvasElement)
    await expect(within(canvasElement).getByRole("separator")).toBeInTheDocument()
  },
}

/** A page whose hero is set to "None" gets no hero at all, not an empty wrapper. */
export const None: Story = {
  args: { type: "none", media: landscapeImage, links },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(".py-8")).toBeEmptyDOMElement()
  },
}

/** A hero with media but no media object (an unpopulated ID) skips the image, not the text. */
export const MediumImpactWithUnpopulatedMedia: Story = {
  args: { type: "mediumImpact", media: 42, links },
  play: async ({ canvasElement }) => {
    await expectHeading(canvasElement)
    await expect(within(canvasElement).queryByRole("img")).not.toBeInTheDocument()
  },
}

/**
 * A hero saved without text renders the rest of itself and no empty
 * rich-text wrapper: RichText returns nothing when it has no data.
 */
const expectNoText: Story["play"] = async ({ canvasElement }) => {
  await expect(canvasElement.querySelector(".payload-richtext")).not.toBeInTheDocument()
}

export const HighImpactWithoutText: Story = {
  ...HighImpact,
  args: { ...HighImpact.args, richText: null },
  play: async (context) => {
    await expectNoText(context)
    await expect(
      within(context.canvasElement).getByRole("link", { name: "Read the volume" }),
    ).toBeInTheDocument()
  },
}

export const MediumImpactWithoutText: Story = {
  args: { ...MediumImpact.args, richText: null },
  play: async (context) => {
    await expectNoText(context)
    await expect(
      within(context.canvasElement).getByRole("link", { name: "About us" }),
    ).toBeInTheDocument()
  },
}

export const LowImpactWithoutText: Story = {
  args: { richText: null },
  play: expectNoText,
}

export const PageHeroWithoutText: Story = {
  args: { type: "pageHero", richText: null },
  play: async (context) => {
    await expectNoText(context)
    await expect(within(context.canvasElement).getByRole("separator")).toBeInTheDocument()
  },
}
