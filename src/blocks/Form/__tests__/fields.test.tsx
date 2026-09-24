import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it } from "vitest"
import {
  type FieldValues,
  FormProvider,
  type UseFormReturn,
  useForm,
  useFormContext,
} from "react-hook-form"

import { Checkbox } from "../Checkbox"
import { Email } from "../Email"
import { Error as FieldError } from "../Error"
import { Number as NumberField } from "../Number"
import { Text } from "../Text"
import { Textarea } from "../Textarea"
import { Width } from "../Width"

/**
 * The field components are only ever rendered by `FormBlockClient`, which
 * hands each one `register`/`errors` off a `useForm()` it owns and wraps the
 * lot in a `FormProvider`. This harness reproduces that wiring so the tests
 * exercise the real react-hook-form plumbing — registration, the validation
 * rules each field attaches, and the values that reach `handleSubmit` — rather
 * than a stubbed stand-in.
 */
function renderField(field: (methods: UseFormReturn) => React.ReactNode): {
  submitted: FieldValues[]
  submit: () => void
} {
  const submitted: FieldValues[] = []

  const Harness = (): React.ReactNode => {
    const methods = useForm()
    return (
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit((data) => {
            submitted.push(data)
          })}
        >
          {field(methods)}
          <button type="submit">Submit</button>
        </form>
      </FormProvider>
    )
  }

  render(<Harness />)

  return {
    submitted,
    submit: () => fireEvent.click(screen.getByRole("button", { name: "Submit" })),
  }
}

afterEach(() => {
  cleanup()
})

describe("Text", () => {
  it("labels the input and marks it as required", () => {
    renderField((methods) => (
      <Text
        blockType="text"
        errors={methods.formState.errors}
        label="First name"
        name="firstName"
        register={methods.register}
        required
      />
    ))

    const input = screen.getByLabelText(/First name/) as HTMLInputElement
    expect(input.type).toBe("text")
    expect(input.name).toBe("firstName")
    expect(screen.getByText("(required)")).toBeInTheDocument()
  })

  it("renders the default value and submits what the visitor typed", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Text
        blockType="text"
        defaultValue="Ada"
        errors={methods.formState.errors}
        label="First name"
        name="firstName"
        register={methods.register}
      />
    ))

    const input = screen.getByLabelText("First name") as HTMLInputElement
    expect(input.value).toBe("Ada")

    fireEvent.change(input, { target: { value: "Grace" } })
    submit()

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toEqual({ firstName: "Grace" })
  })

  it("blocks submission and shows the error when a required field is empty", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Text
        blockType="text"
        errors={methods.formState.errors}
        label="First name"
        name="firstName"
        register={methods.register}
        required
      />
    ))

    submit()

    await waitFor(() => expect(screen.getByText("This field is required")).toBeInTheDocument())
    expect(submitted).toHaveLength(0)
  })
})

// `Textarea` and `Number` both declare their props as `TextField & {...}`, so
// their `blockType` is "text" here even though the Payload blocks are named
// "textarea" and "number".
describe("Textarea", () => {
  it("defaults to three rows and honours an override", () => {
    renderField((methods) => (
      <Textarea
        blockType="text"
        errors={methods.formState.errors}
        label="Message"
        name="message"
        register={methods.register}
      />
    ))

    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).rows).toBe(3)

    cleanup()

    renderField((methods) => (
      <Textarea
        blockType="text"
        errors={methods.formState.errors}
        label="Message"
        name="message"
        register={methods.register}
        rows={8}
      />
    ))

    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).rows).toBe(8)
  })

  it("submits the typed value", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Textarea
        blockType="text"
        errors={methods.formState.errors}
        label="Message"
        name="message"
        register={methods.register}
        required
      />
    ))

    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: "Hello there" } })
    submit()

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toEqual({ message: "Hello there" })
  })
})

describe("Number", () => {
  it("renders a number input and submits its value", async () => {
    const { submitted, submit } = renderField((methods) => (
      <NumberField
        blockType="text"
        errors={methods.formState.errors}
        label="Quantity"
        name="quantity"
        register={methods.register}
        required
      />
    ))

    const input = screen.getByLabelText(/Quantity/) as HTMLInputElement
    expect(input.type).toBe("number")

    fireEvent.change(input, { target: { value: "42" } })
    submit()

    await waitFor(() => expect(submitted).toHaveLength(1))
    // The field registers without `valueAsNumber`, so the submission carries
    // the raw string. Payload stores it as-is.
    expect(submitted[0]).toEqual({ quantity: "42" })
  })
})

describe("Email", () => {
  it("rejects a value that does not look like an address", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Email
        blockType="email"
        errors={methods.formState.errors}
        label="Email"
        name="email"
        register={methods.register}
        required
      />
    ))

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "not-an-address" } })
    submit()

    await waitFor(() => expect(screen.getByText("This field is required")).toBeInTheDocument())
    expect(submitted).toHaveLength(0)
  })

  it("accepts a well-formed address", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Email
        blockType="email"
        errors={methods.formState.errors}
        label="Email"
        name="email"
        register={methods.register}
        required
      />
    ))

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "ada@example.com" } })
    submit()

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toEqual({ email: "ada@example.com" })
  })
})

describe("Checkbox", () => {
  it("writes a boolean into form state when toggled", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Checkbox
        blockType="checkbox"
        errors={methods.formState.errors}
        label="Subscribe"
        name="subscribe"
        register={methods.register}
      />
    ))

    fireEvent.click(screen.getByRole("checkbox"))
    submit()

    // The component pushes the new state through `setValue`, so this asserts
    // the `useFormContext` bridge still lands a real boolean — not "on".
    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toEqual({ subscribe: true })
  })

  it("blocks submission while a required box is unchecked", async () => {
    const { submitted, submit } = renderField((methods) => (
      <Checkbox
        blockType="checkbox"
        errors={methods.formState.errors}
        label="Accept the terms"
        name="terms"
        register={methods.register}
        required
      />
    ))

    submit()

    await waitFor(() => expect(screen.getByText("This field is required")).toBeInTheDocument())
    expect(submitted).toHaveLength(0)
  })
})

describe("Error", () => {
  it("prefers the message on the error over the generic fallback", async () => {
    const SetError = (): null => {
      const { setError } = useFormContext()
      React.useEffect(() => {
        setError("email", { message: "That address is already registered" })
      }, [setError])
      return null
    }

    const Harness = (): React.ReactNode => {
      const methods = useForm()
      return (
        <FormProvider {...methods}>
          <SetError />
          <FieldError name="email" />
        </FormProvider>
      )
    }

    render(<Harness />)

    await waitFor(() =>
      expect(screen.getByText("That address is already registered")).toBeInTheDocument(),
    )
  })

  it("falls back to the generic copy when the error carries no message", () => {
    const Harness = (): React.ReactNode => {
      const methods = useForm()
      return (
        <FormProvider {...methods}>
          <FieldError name="email" />
        </FormProvider>
      )
    }

    render(<Harness />)

    expect(screen.getByText("This field is required")).toBeInTheDocument()
  })
})

describe("Width", () => {
  it("constrains the field to a percentage when a width is set", () => {
    const { container } = render(
      <Width width={50}>
        <span>child</span>
      </Width>,
    )

    expect((container.firstChild as HTMLElement).style.maxWidth).toBe("50%")
  })

  it("leaves the width unset when the field has none", () => {
    const { container } = render(
      <Width>
        <span>child</span>
      </Width>,
    )

    expect((container.firstChild as HTMLElement).style.maxWidth).toBe("")
  })
})
