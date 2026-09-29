import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { withPayloadAdminTheme } from "@/stories/payloadAdminTheme"

import { MediaReferenceList } from "./MediaReferenceList"

const meta = {
  title: "Admin/Media/MediaReferenceList",
  component: MediaReferenceList,
  decorators: [withPayloadAdminTheme],
  args: {
    loading: false,
    references: [
      {
        collection: "articles",
        field: "heroImage",
        docId: 12,
        docTitle: "The Case for Permitting Reform",
        docSlug: "the-case-for-permitting-reform",
      },
      {
        collection: "articles",
        field: "content (mediaBlock, timeline)",
        docId: 31,
        docTitle: "A Short History of the Filibuster",
        docSlug: "a-short-history-of-the-filibuster",
      },
      {
        collection: "users",
        field: "profileImage",
        docId: 4,
        docTitle: "Jordan Rivera",
      },
    ],
  },
} satisfies Meta<typeof MediaReferenceList>

export default meta
type Story = StoryObj<typeof meta>

export const Referenced: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3)

    const link = canvas.getByRole("link", { name: "The Case for Permitting Reform" })
    await expect(link).toHaveAttribute("href", "/admin/collections/articles/12")
    await expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
    await expect(canvas.getByText(/User — profile image/)).toBeInTheDocument()
  },
}

export const NotReferenced: Story = {
  args: { references: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Not referenced in any published documents.")).toBeInTheDocument()
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument()
  },
}

export const Loading: Story = {
  args: { loading: true, references: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Checking references…",
    )
  },
}

export const Detachable: Story = {
  args: { onDetach: fn(() => new Promise<void>(() => undefined)) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Detach from The Case for Permitting Reform (hero image)",
      }),
    )

    const confirm = canvas.getByRole("group", {
      name: "Confirm detaching from The Case for Permitting Reform",
    })
    await expect(confirm).toHaveTextContent("Remove it from the article hero image and publish")

    await userEvent.click(within(confirm).getByRole("button", { name: "Detach and publish" }))
    await expect(args.onDetach).toHaveBeenCalledWith(
      expect.objectContaining({ docId: 12, field: "heroImage" }),
    )
    await expect(within(confirm).getByRole("button", { name: "Publishing…" })).toBeDisabled()
  },
}

export const DetachRefused: Story = {
  args: {
    onDetach: fn(() =>
      Promise.reject(
        new Error(
          "This document has unpublished changes. Publish or discard them first, so detaching doesn't publish them too.",
        ),
      ),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: /Detach from Jordan Rivera/ }))
    await userEvent.click(canvas.getByRole("button", { name: "Detach and publish" }))

    await expect(await canvas.findByRole("alert")).toHaveTextContent("unpublished changes")
    await expect(canvas.getByRole("button", { name: /Detach from Jordan Rivera/ })).toBeEnabled()
  },
}
