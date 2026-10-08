import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import type { UnsplashPhoto } from "@/integrations/unsplash"
import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { UnsplashSearch, type SearchUnsplash, type UnsplashResults } from "./UnsplashSearch"

const photo = (
  id: string,
  file: string,
  width: number,
  height: number,
  name: string,
): UnsplashPhoto => ({
  id,
  width,
  height,
  color: "#8090a0",
  alt: `${file.replace(".svg", "")} photo`,
  thumbUrl: `/storybook-assets/${file}`,
  rawUrl: `https://images.unsplash.com/${id}`,
  pageUrl: `https://unsplash.com/photos/${id}`,
  downloadLocation: `https://api.unsplash.com/photos/${id}/download`,
  photographer: { name, username: name.toLowerCase(), profileUrl: `https://unsplash.com/@${id}` },
})

const page = (results: UnsplashPhoto[], totalPages = 1): UnsplashResults => ({
  total: results.length * totalPages,
  totalPages,
  results,
  homeUrl: "https://unsplash.com/?utm_source=pragmatic_papers_development&utm_medium=referral",
})

const first = [
  photo("a1", "landscape.svg", 1600, 900, "Ada"),
  photo("b2", "portrait.svg", 800, 1200, "Grace"),
  photo("c3", "square.svg", 1000, 1000, "Katherine"),
]
const second = [photo("d4", "wide.svg", 2000, 800, "Dorothy")]

const meta = {
  title: "Admin/Media/UnsplashSearch",
  component: UnsplashSearch,
  decorators: [withPayloadAdminTheme],
  args: {
    search: fn<SearchUnsplash>(async (_q, p) => (p === 1 ? page(first, 2) : page(second, 2))),
    onPick: fn(async () => undefined),
  },
} satisfies Meta<typeof UnsplashSearch>

export default meta
type Story = StoryObj<typeof meta>

export const SearchAndPick: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("searchbox", { name: "Search Unsplash" }), "lighthouse")
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Shape" }), "landscape")
    await userEvent.click(canvas.getByRole("button", { name: "Search" }))

    await expect(await canvas.findAllByRole("listitem")).toHaveLength(3)
    await expect(args.search).toHaveBeenCalledWith("lighthouse", 1, "landscape")
    // Every photo credits its photographer, and the list credits Unsplash.
    await expect(canvas.getByRole("link", { name: "Grace" })).toHaveAttribute(
      "href",
      "https://unsplash.com/@b2",
    )
    await expect(canvas.getByRole("link", { name: "Unsplash" })).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    )

    await userEvent.click(canvas.getByRole("button", { name: "More photos" }))
    await waitFor(() => expect(canvas.getAllByRole("listitem")).toHaveLength(4))
    await expect(canvas.queryByRole("button", { name: "More photos" })).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole("button", { name: "Use portrait photo by Grace" }))
    await expect(args.onPick).toHaveBeenCalledWith(first[1])
  },
}

export const NoResults: Story = {
  args: { search: fn<SearchUnsplash>(async () => page([])) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("searchbox"), "zzzz{enter}")
    await expect(await canvas.findByText("No photos match “zzzz”.")).toBeInTheDocument()
  },
}

export const Failed: Story = {
  args: {
    search: fn<SearchUnsplash>(async () => {
      throw new Error("Unsplash isn't set up on this site.")
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("searchbox"), "x{enter}")
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Unsplash isn't set up on this site.",
    )
  },
}

export const PickFailed: Story = {
  args: {
    search: fn<SearchUnsplash>(async () => page(first)),
    onPick: fn(async () => {
      throw new Error("Unsplash download failed. Try again in a moment.")
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("searchbox"), "x{enter}")
    await userEvent.click(await canvas.findByRole("button", { name: "Use landscape photo by Ada" }))
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Unsplash download failed")
    // A failed pick leaves the results to pick from again.
    await expect(canvas.getByRole("button", { name: "Use landscape photo by Ada" })).toBeEnabled()
  },
}
