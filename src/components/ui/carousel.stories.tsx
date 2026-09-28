import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselIndicators,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./carousel"

const slides = ["Housing", "Labor", "Courts", "Climate"]

function Slides(props: React.ComponentProps<typeof Carousel>): React.ReactNode {
  const [current, setCurrent] = useState(0)

  const setApi = (api: CarouselApi): void => {
    api?.on("select", () => setCurrent(api.selectedScrollSnap()))
  }

  return (
    <Carousel className="mx-auto max-w-xs" aria-label="Featured topics" setApi={setApi} {...props}>
      <CarouselContent>
        {slides.map((slide, index) => (
          <CarouselItem key={slide} aria-label={`${index + 1} of ${slides.length}`}>
            <div className="bg-muted flex aspect-square items-center justify-center rounded-md text-2xl font-bold">
              {slide}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
      <CarouselIndicators count={slides.length} current={current} className="bottom-2" />
    </Carousel>
  )
}

const meta = {
  title: "UI/Carousel",
  component: Carousel,
  parameters: { layout: "centered" },
  render: (args) => <Slides {...args} />,
  decorators: [
    (Story) => (
      <div className="w-[26rem] px-12">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Carousel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const previous = canvas.getByRole("button", { name: "Previous slide" })
    const next = canvas.getByRole("button", { name: "Next slide" })
    await waitFor(() => expect(next).toBeEnabled())
    await expect(previous).toBeDisabled()
    await userEvent.click(next)
    await waitFor(() => expect(previous).toBeEnabled())
  },
}

export const Loop: Story = {
  args: { opts: { loop: true } },
}
