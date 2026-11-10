import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, waitFor, within } from "storybook/test"

import { authors } from "@/stories/fixtures/docs"

import { AuthorCard } from "./AuthorCard"
import { AuthorLinks } from "./AuthorLinks"
import { AuthorList } from "./AuthorList"

const meta = {
  title: "Components/Authors",
  component: AuthorCard,
  args: { author: authors[0]! },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthorCard>

export default meta
type Story = StoryObj<typeof meta>

export const Card: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const links = canvas.getByRole("navigation", { name: "Links for Jordan Rivera" })
    await expect(within(links).getAllByRole("link")).toHaveLength(2)
    for (const profile of canvas.getAllByRole("link", { name: "Jordan Rivera" })) {
      await expect(profile).toHaveAttribute("href", "/contributors/jordan-rivera")
    }
  },
}

/** Focus on any link in the card, its social links included, lifts the photo and dims the name. */
export const CardFocusInside: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const photo = canvasElement.querySelector<HTMLElement>("[data-slot=avatar]")!
    const name = canvas
      .getAllByRole("link", { name: "Jordan Rivera" })
      .find((link) => link.tabIndex !== -1)!
    await expect(getComputedStyle(photo).filter).toBe("none")

    const links = canvas.getByRole("navigation", { name: "Links for Jordan Rivera" })
    within(links).getAllByRole("link")[0]!.focus()

    await waitFor(() => expect(getComputedStyle(photo).filter).toContain("contrast(1.16)"))
    await expect(getComputedStyle(name).color).toMatch(/\/ 0\.8\)$/)
  },
}

export const CardWithoutPhotoOrLinks: Story = {
  args: { author: authors[1]! },
}

export const List: Story = {
  render: () => <AuthorList authors={authors} />,
  play: async ({ canvasElement }) => {
    const section = within(canvasElement).getByRole("region", { name: "Authors" })
    await expect(within(section).getByRole("heading", { name: "Meet the Authors" })).toBeVisible()
  },
}

export const ListOfOne: Story = {
  render: () => <AuthorList authors={authors.slice(0, 1)} />,
}

export const Links: Story = {
  render: () => (
    <AuthorLinks
      authorName="Jordan Rivera"
      socials={[
        { id: "x", link: { type: "custom", url: "https://x.com/example", label: "X" } },
        { id: "yt", link: { type: "custom", url: "youtube.com/@example", label: "YouTube" } },
        { id: "gh", link: { type: "custom", url: "https://github.com/example", label: "GitHub" } },
        { id: "web", link: { type: "custom", url: "https://example.com", label: "Website" } },
      ]}
    />
  ),
}
