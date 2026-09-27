import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Settings } from "lucide-react"
import { useState } from "react"
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu"

const onSelect = fn()

function SettingsMenu(props: React.ComponentProps<typeof DropdownMenu>): React.ReactNode {
  const [rate, setRate] = useState<unknown>("1")
  const [autoplay, setAutoplay] = useState(true)

  return (
    <DropdownMenu {...props}>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Settings" />}>
        <Settings />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Speed</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={rate} onValueChange={setRate}>
            {["0.75", "1", "1.5"].map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {value}×
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={autoplay} onCheckedChange={setAutoplay}>
          Autoplay next
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Download</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onSelect("mp3")}>MP3</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelect("transcript")}>Transcript</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSelect("report")}>
          Report a problem <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onSelect("reset")}>
          Reset player
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const meta = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  render: (args) => <SettingsMenu {...args} />,
} satisfies Meta<typeof DropdownMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Settings" })
    await userEvent.click(trigger)
    const speed = await screen.findByRole("menuitemradio", { name: "1.5×" })
    await userEvent.click(speed)
    await waitFor(() => expect(speed).toHaveAttribute("aria-checked", "true"))

    const autoplay = screen.getByRole("menuitemcheckbox", { name: "Autoplay next" })
    await expect(autoplay).toHaveAttribute("aria-checked", "true")

    await userEvent.click(screen.getByRole("menuitem", { name: /Report a problem/ }))
    await expect(onSelect).toHaveBeenCalledWith("report")
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  },
}

export const Open: Story = {
  args: { defaultOpen: true },
}
