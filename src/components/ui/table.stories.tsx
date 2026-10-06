import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"

const rows = [
  { state: "Arizona", margin: "+0.3", turnout: "79.9%" },
  { state: "Georgia", margin: "+0.2", turnout: "72.8%" },
  { state: "Wisconsin", margin: "+0.6", turnout: "75.8%" },
]

const meta = {
  title: "UI/Table",
  component: Table,
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>Closest states in the 2020 presidential election.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>State</TableHead>
          <TableHead>Margin (pts)</TableHead>
          <TableHead>Turnout</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.state}>
            <TableCell>{row.state}</TableCell>
            <TableCell>{row.margin}</TableCell>
            <TableCell>{row.turnout}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Average turnout</TableCell>
          <TableCell>76.2%</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
}
