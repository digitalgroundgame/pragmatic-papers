import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { FootnoteList } from "."

const meta = {
  title: "Components/FootnoteList",
  component: FootnoteList,
  args: {
    footnotes: [
      {
        index: 1,
        note: "Certified results, Jackson County Board of Election Commissioners.",
        attributionEnabled: true,
        link: { type: "custom", url: "https://example.com/results" },
      },
      {
        index: 2,
        note: "Turnout is ballots cast over registered voters on election day.",
        attributionEnabled: false,
      },
      {
        index: 3,
        note: "Interview with the county clerk, January 2026.",
        attributionEnabled: true,
        link: { type: "custom", url: "https://example.com/interview", newTab: true },
      },
    ],
  },
} satisfies Meta<typeof FootnoteList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const note = canvasElement.querySelector("#footnote-2")
    await expect(note).toHaveTextContent(/ballots cast over registered voters/)
    await expect(within(canvasElement).getAllByRole("link")).toHaveLength(2)
  },
}

// The article page sets its column with `mx-auto` inside a flex column, so the column
// is as wide as its content's narrowest unbreakable run. A URL that only breaks under
// `overflow-wrap: break-word` still counts as one run there and widens the page.
export const LongLinkOnMobile: Story = {
  args: {
    footnotes: [
      {
        index: 1,
        note: "Wikipedia, International Emergency Economic Powers Act",
        attributionEnabled: true,
        link: {
          type: "custom",
          url: "https://en.wikipedia.org/wiki/International_Emergency_Economic_Powers_Act_of_1977_and_its_amendments",
        },
      },
    ],
  },
  decorators: [
    (Story) => (
      <div data-testid="page" className="flex w-[320px] flex-col">
        <div data-testid="column" className="mx-auto max-w-2xl">
          <Story />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const page = within(canvasElement).getByTestId("page")
    const column = within(canvasElement).getByTestId("column")
    await expect(column.getBoundingClientRect().width).toBeLessThanOrEqual(
      page.getBoundingClientRect().width,
    )
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth)
  },
}
