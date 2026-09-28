import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "./navigation-menu"

const topics = [
  { href: "/topics/politics", title: "Politics", description: "Elections, parties, and power." },
  { href: "/topics/economy", title: "Economy", description: "Jobs, prices, and policy." },
  { href: "/topics/courts", title: "Courts", description: "Judges and the rulings they make." },
]

const meta = {
  title: "UI/NavigationMenu",
  component: NavigationMenu,
  parameters: { layout: "centered" },
  args: { "aria-label": "Main" },
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Topics</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-80 gap-1 p-2">
              {topics.map((topic) => (
                <li key={topic.href}>
                  <NavigationMenuLink href={topic.href}>
                    <div className="font-medium">{topic.title}</div>
                    <p className="text-muted-foreground text-sm">{topic.description}</p>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="/volumes" className={navigationMenuTriggerStyle()}>
            Volumes
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
} satisfies Meta<typeof NavigationMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Topics" })
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(await screen.findByRole("link", { name: /Economy/ })).toHaveAttribute(
      "href",
      "/topics/economy",
    )
  },
}
