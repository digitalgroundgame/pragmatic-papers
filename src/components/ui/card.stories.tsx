import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { Button } from "./button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card"

const meta = {
  title: "UI/Card",
  component: Card,
  args: { size: "default" },
  argTypes: { size: { control: "inline-radio", options: ["default", "sm"] } },
  render: (args) => (
    <Card className="max-w-sm" {...args}>
      <CardHeader>
        <CardTitle>Volume XII</CardTitle>
        <CardDescription>Seven articles on housing, labor, and the courts.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Save
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>Published every Sunday. Read the full volume or jump to a single article.</p>
      </CardContent>
      <CardFooter>
        <Button>Read volume</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
  args: { size: "sm" },
}
