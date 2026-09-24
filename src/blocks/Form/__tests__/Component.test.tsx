import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Form, FormBlock as FormBlockType } from "@/payload-types"

const captured = vi.hoisted(() => ({
  props: [] as {
    form: Form
    intro?: React.ReactNode
    confirmation?: React.ReactNode
    messages?: Record<number, React.ReactNode>
  }[],
}))

// The block hands finished elements to the client component; capturing the
// props is how we assert what the server decided to render.
vi.mock("../FormBlockClient", () => ({
  FormBlockClient: (props: (typeof captured.props)[number]) => {
    captured.props.push(props)
    return <div data-testid="client" />
  },
}))

// `RichText` is server-only and renders blocks that query Payload. Swap it for
// a marker so the composition is what is under test, not Lexical.
vi.mock("@/components/RichText", () => ({
  default: ({ data }: { data: { marker?: string } }) => <span>{data?.marker}</span>,
}))

import { FormBlock } from "../Component"

/** Stand-in for a Lexical editor state — only the marker is ever read. */
function richText(marker: string): NonNullable<Form["confirmationMessage"]> {
  return { marker } as unknown as NonNullable<Form["confirmationMessage"]>
}

function buildBlock(form: Partial<Form>, block: Partial<FormBlockType> = {}): FormBlockType {
  return {
    blockType: "formBlock",
    form: { id: 1, title: "Contact", ...form } as Form,
    ...block,
  } as FormBlockType
}

function lastProps(): (typeof captured.props)[number] {
  const props = captured.props.at(-1)
  if (!props) throw new Error("FormBlockClient was never rendered")
  return props
}

afterEach(() => {
  cleanup()
  captured.props.length = 0
})

describe("FormBlock", () => {
  it("renders nothing when the form relationship was not populated", () => {
    const { container } = render(<FormBlock {...buildBlock({}, { form: 12 as never })} />)

    expect(container.innerHTML).toBe("")
    expect(captured.props).toHaveLength(0)
  })

  it("passes the intro through only when the block enables it", () => {
    render(
      <FormBlock
        {...buildBlock({}, { enableIntro: true, introContent: richText("intro copy") as never })}
      />,
    )
    expect(render(<>{lastProps().intro}</>).container.textContent).toBe("intro copy")

    cleanup()

    render(
      <FormBlock
        {...buildBlock({}, { enableIntro: false, introContent: richText("intro copy") as never })}
      />,
    )
    expect(lastProps().intro).toBeNull()
  })

  it("passes the confirmation message only for message-type confirmations", () => {
    render(
      <FormBlock
        {...buildBlock({
          confirmationType: "message",
          confirmationMessage: richText("thanks"),
        })}
      />,
    )
    expect(render(<>{lastProps().confirmation}</>).container.textContent).toBe("thanks")

    cleanup()

    render(
      <FormBlock
        {...buildBlock({
          confirmationType: "redirect",
          confirmationMessage: richText("thanks"),
          redirect: { url: "/thanks" },
        })}
      />,
    )
    expect(lastProps().confirmation).toBeNull()
  })

  it("keys pre-rendered message fields by their position in the field list", () => {
    render(
      <FormBlock
        {...buildBlock({
          fields: [
            { blockType: "text", name: "firstName", label: "First name" },
            { blockType: "message", message: richText("a note") },
            { blockType: "email", name: "email", label: "Email" },
            { blockType: "message", message: richText("another note") },
            // A message field with no content contributes no entry.
            { blockType: "message" },
          ] as unknown as Form["fields"],
        })}
      />,
    )

    const { messages } = lastProps()
    expect(Object.keys(messages ?? {})).toEqual(["1", "3"])
    expect(render(<>{messages?.[1]}</>).container.textContent).toBe("a note")
    expect(render(<>{messages?.[3]}</>).container.textContent).toBe("another note")
  })
})
