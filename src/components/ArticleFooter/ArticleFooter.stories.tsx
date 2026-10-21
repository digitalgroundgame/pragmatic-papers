import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import { AuthorList } from "@/components/Authors/AuthorList"
import { CommentsUnpublished } from "@/components/Comments/Unpublished"
import { FootnoteList } from "@/components/FootnoteList"
import { TopicsList } from "@/components/Topics/TopicsList"
import { Separator } from "@/components/ui/separator"
import type { FootnotesField } from "@/payload-types"
import { authors, topics } from "@/stories/fixtures/docs"

import { ArticleFooter } from "."

const footnotes: FootnotesField = [
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
]

const meta = {
  title: "Components/ArticleFooter",
  component: ArticleFooter,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    children: (
      <>
        <FootnoteList footnotes={footnotes} />
        <div className="space-y-4">
          <Separator />
          <TopicsList topics={topics} label="Topics:" />
        </div>
        <AuthorList aria-label="Article Authors" authors={authors.slice(0, 2)} />
        <CommentsUnpublished />
      </>
    ),
  },
} satisfies Meta<typeof ArticleFooter>

export default meta
type Story = StoryObj<typeof meta>

/** Sources, topics, authors and comments, each its own evenly spaced section. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const footer = canvas.getByRole("region", { name: "Article Authors" }).parentElement!

    // Comments sits at the same level as Meet the Authors, and looks the same.
    const authorsHeading = canvas.getByRole("heading", { level: 2, name: "Meet the Authors" })
    const commentsHeading = canvas.getByRole("heading", { level: 2, name: "Comments" })
    await expect(getComputedStyle(commentsHeading).fontSize).toBe(
      getComputedStyle(authorsHeading).fontSize,
    )

    // The topics carry a small label, not a heading.
    const topicsSection = canvas.getByRole("region", { name: "Topics" })
    await expect(topicsSection).toHaveTextContent(/^Topics:/)
    await expect(within(topicsSection).queryByRole("heading")).not.toBeInTheDocument()

    // Every section is the same distance from the one before it.
    const sections = [...footer.children]
    const gaps = sections.slice(1).map((section, i) => {
      const above = sections[i]!.getBoundingClientRect().bottom
      return Math.round(section.getBoundingClientRect().top - above)
    })
    await expect(gaps).toHaveLength(3)
    await expect(new Set(gaps).size).toBe(1)
    await expect(gaps[0]).toBeGreaterThanOrEqual(32)
  },
}

/** Without sources or topics, the authors and comments keep their spacing. */
export const AuthorsOnly: Story = {
  args: {
    children: (
      <>
        <FootnoteList footnotes={[]} />
        <div className="space-y-4">
          <Separator />
          <TopicsList topics={[]} label="Topics:" />
        </div>
        <AuthorList aria-label="Article Authors" authors={authors.slice(0, 2)} />
        <CommentsUnpublished />
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("heading", { name: "Sources" })).not.toBeInTheDocument()
    await expect(canvas.queryByRole("region", { name: "Topics" })).not.toBeInTheDocument()
    await expect(canvas.getByRole("heading", { name: "Meet the Authors" })).toBeInTheDocument()
  },
}
