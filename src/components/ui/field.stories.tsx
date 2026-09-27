import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { Checkbox } from "./checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "./field"
import { Input } from "./input"
import { Textarea } from "./textarea"

const meta = {
  title: "UI/Field",
  component: Field,
  args: { orientation: "vertical" },
  argTypes: {
    orientation: { control: "inline-radio", options: ["vertical", "horizontal", "responsive"] },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Field {...args}>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input id="email" type="email" aria-describedby="email-description" />
      <FieldDescription id="email-description">We send one email a week.</FieldDescription>
    </Field>
  ),
}

export const Invalid: Story = {
  render: (args) => (
    <Field {...args} data-invalid>
      <FieldLabel htmlFor="email-invalid">Email</FieldLabel>
      <Input id="email-invalid" aria-invalid defaultValue="not-an-email" />
      <FieldError errors={[{ message: "Enter a valid email address." }]} />
    </Field>
  ),
}

export const MultipleErrors: Story = {
  render: (args) => (
    <Field {...args} data-invalid>
      <FieldLabel htmlFor="message">Message</FieldLabel>
      <Textarea id="message" aria-invalid />
      <FieldError
        errors={[
          { message: "A message is required." },
          { message: "Keep it under 500 characters." },
          { message: "A message is required." },
        ]}
      />
    </Field>
  ),
}

export const Horizontal: Story = {
  args: { orientation: "horizontal" },
  render: (args) => (
    <Field {...args}>
      <Checkbox id="terms" />
      <FieldContent>
        <FieldLabel htmlFor="terms">Email me new volumes</FieldLabel>
        <FieldDescription>Unsubscribe any time.</FieldDescription>
      </FieldContent>
    </Field>
  ),
}

export const Fieldset: Story = {
  render: () => (
    <FieldSet>
      <FieldLegend>Your details</FieldLegend>
      <FieldDescription>Only editors see this.</FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="first">First name</FieldLabel>
          <Input id="first" />
        </Field>
        <FieldSeparator>and</FieldSeparator>
        <Field>
          <FieldLabel htmlFor="last">Last name</FieldLabel>
          <Input id="last" />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
}
