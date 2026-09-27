import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { knownContrastIssue } from "@/stories/a11y"
import { volumes } from "@/stories/fixtures/docs"

import { VolumesView } from "."

const meta = {
  title: "Components/VolumesView",
  component: VolumesView,
  parameters: knownContrastIssue,
  args: { volumes: volumes.slice(0, 3) },
  decorators: [
    (Story) => (
      <div className="max-w-3xl space-y-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VolumesView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
