import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, spyOn, userEvent, within } from "storybook/test"

import type { HeldAchievement } from "@/plugins/achievements"
import type { AccountSummary } from "@/plugins/sso/endpoints/account"
import type { LinkedProvider } from "@/plugins/sso/types"

import { Account } from "."

const member: AccountSummary = {
  name: "Ada Reader",
  email: "ada@example.com",
  managedInAdmin: false,
}

const links: LinkedProvider[] = [
  { id: "google", label: "Google", linked: false },
  { id: "discord", label: "Discord", linked: true },
  { id: "destiny", label: "Destiny.gg", linked: false },
]

const achievements: HeldAchievement[] = [
  {
    key: "early-member",
    label: "Early member",
    description: "One of the first readers to make an account.",
    badge: "Early member",
    earnedAt: "2026-10-18T12:00:00.000Z",
  },
]

/**
 * Answers `/api/account` with `account` (401 when null), `/api/auth-links` with `links` and
 * `/api/achievements/mine` with `achievements`.
 */
function serve(account: AccountSummary | null) {
  return () => {
    const fetchSpy = spyOn(window, "fetch").mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith("/auth-links")) return Response.json({ providers: links })
      if (url.endsWith("/achievements/mine")) return Response.json({ achievements })
      if (url.endsWith("/account") && init?.method === "PATCH") {
        const { name } = JSON.parse(String(init.body)) as { name: string }
        return Response.json({ ...member, name })
      }
      if (url.endsWith("/account")) {
        return account ? Response.json(account) : Response.json({}, { status: 401 })
      }
      return Response.json({})
    })
    return () => fetchSpy.mockRestore()
  }
}

const meta = {
  title: "Components/Account",
  component: Account,
  args: {
    providers: [
      { id: "google", label: "Google" },
      { id: "discord", label: "Discord" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Account>

export default meta
type Story = StoryObj<typeof meta>

export const Member: Story = {
  beforeEach: serve(member),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = await canvas.findByRole("textbox", { name: "Display name" })
    await userEvent.clear(name)
    await userEvent.type(name, "Ada L.")
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
    await expect(await canvas.findByText("Saved.")).toBeInTheDocument()

    await expect(await canvas.findByRole("heading", { name: "Achievements" })).toBeInTheDocument()
    await expect(canvas.getByText("Early member")).toBeInTheDocument()

    // Their only sign-in can't be disconnected.
    await expect(await canvas.findByRole("button", { name: "Disconnect Discord" })).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Connect Destiny.gg" })).toBeEnabled()

    await userEvent.click(canvas.getByRole("button", { name: "Delete account" }))
    await expect(canvas.getByRole("button", { name: "Yes, delete my account" })).toBeInTheDocument()
  },
}

export const NoEmailAddress: Story = {
  beforeEach: serve({ ...member, name: "DestinyFan", email: null }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/no email address yet/)).toBeInTheDocument()
    await expect(canvas.queryByText(/@/)).not.toBeInTheDocument()
  },
}

export const Staff: Story = {
  beforeEach: serve({ ...member, name: "Grace Editor", managedInAdmin: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("link", { name: "open your account there" }),
    ).toHaveAttribute("href", "/admin/account")
    await expect(canvas.queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument()
  },
}

export const SignedOut: Story = {
  beforeEach: serve(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/not signed in/)).toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Sign in with Discord" })).toBeEnabled()
  },
}
