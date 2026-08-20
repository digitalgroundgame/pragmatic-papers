import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Form } from "@/payload-types"

import { FormBlockClient } from "../FormBlockClient"
import { chooseOption } from "./helpers"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

/**
 * A form covering every field type the block can render, plus a `message`
 * field — those are rendered on the server and handed in via `messages`, so
 * the client component has to slot them back in by index.
 */
function buildForm(overrides: Partial<Form> = {}): Form {
  return {
    id: 7,
    title: "Contact us",
    submitButtonLabel: "Send it",
    confirmationType: "message",
    fields: [
      { blockType: "text", name: "firstName", label: "First name", required: true },
      { blockType: "email", name: "email", label: "Email", required: true },
      { blockType: "message" },
      { blockType: "textarea", name: "notes", label: "Notes" },
      { blockType: "number", name: "quantity", label: "Quantity" },
      { blockType: "checkbox", name: "subscribe", label: "Subscribe" },
      {
        blockType: "select",
        name: "topic",
        label: "Topic",
        options: [
          { label: "Sales", value: "sales" },
          { label: "Support", value: "support" },
        ],
      },
    ],
    ...overrides,
  } as Form
}

function renderBlock(form: Form = buildForm()): void {
  render(
    <FormBlockClient
      form={form}
      intro={<p>Tell us what you think</p>}
      confirmation={<p>Thanks for reaching out</p>}
      messages={{ 2: <p>We reply within two days</p> }}
    />,
  )
}

function fillRequiredFields(): void {
  fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Ada" } })
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ada@example.com" } })
}

function submit(): void {
  fireEvent.click(screen.getByRole("button", { name: "Send it" }))
}

function mockFetch(response: { status: number; body?: unknown }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    status: response.status,
    json: async () => response.body ?? {},
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function submissionOf(fetchMock: ReturnType<typeof vi.fn>): {
  form: number
  submissionData: { field: string; value: unknown }[]
} {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return JSON.parse(init.body as string)
}

beforeEach(() => {
  push.mockClear()
})

afterEach(() => {
  cleanup()
  // Restored here too so a failing assertion inside the fake-timer test cannot
  // leak them into the rest of the file.
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("FormBlockClient", () => {
  it("renders the intro, every field, the server-rendered message and the submit label", () => {
    renderBlock()

    expect(screen.getByText("Tell us what you think")).toBeInTheDocument()
    expect(screen.getByText("We reply within two days")).toBeInTheDocument()
    expect(screen.getByLabelText(/First name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument()
    expect(screen.getByLabelText("Notes")).toBeInTheDocument()
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument()
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send it" })).toBeInTheDocument()
  })

  it("ignores a block type it has no field component for", () => {
    renderBlock(
      buildForm({
        fields: [
          { blockType: "text", name: "firstName", label: "First name" },
          // Payload can hold field types this block does not render (a
          // `payment` field, say). It should skip them, not crash.
          { blockType: "payment", name: "payment", label: "Payment" },
        ] as unknown as Form["fields"],
      }),
    )

    expect(screen.getByLabelText("First name")).toBeInTheDocument()
    expect(screen.queryByLabelText("Payment")).not.toBeInTheDocument()
  })

  it("does not submit while required fields are empty", async () => {
    const fetchMock = mockFetch({ status: 200 })
    renderBlock()

    submit()

    await waitFor(() => expect(screen.getAllByText("This field is required")).toHaveLength(2))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts the visitor's answers to the form-submissions endpoint", async () => {
    const fetchMock = mockFetch({ status: 200 })
    renderBlock()

    fillRequiredFields()
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Hello" } })
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } })
    fireEvent.click(screen.getByRole("checkbox"))
    await chooseOption(screen.getByRole("combobox"), "Support")

    submit()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url.endsWith("/api/form-submissions")).toBe(true)
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json")

    const { form, submissionData } = submissionOf(fetchMock)
    expect(form).toBe(7)
    expect(submissionData).toEqual(
      expect.arrayContaining([
        { field: "firstName", value: "Ada" },
        { field: "email", value: "ada@example.com" },
        { field: "notes", value: "Hello" },
        { field: "quantity", value: "3" },
        { field: "subscribe", value: true },
        { field: "topic", value: "support" },
      ]),
    )
  })

  it("shows the loading notice once a slow submit passes the one-second mark", async () => {
    let settle: (value: { status: number; json: () => Promise<unknown> }) => void = () => undefined
    const pending = new Promise<{ status: number; json: () => Promise<unknown> }>((resolve) => {
      settle = resolve
    })
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderBlock()

    fillRequiredFields()
    submit()

    await vi.advanceTimersByTimeAsync(1_000)
    await waitFor(() => expect(screen.getByText("Loading, please wait...")).toBeInTheDocument())

    settle({ status: 200, json: async () => ({}) })

    await waitFor(() => expect(screen.getByText("Thanks for reaching out")).toBeInTheDocument())
    expect(screen.queryByText("Loading, please wait...")).not.toBeInTheDocument()
  })

  it("replaces the form with the confirmation message after a successful submit", async () => {
    mockFetch({ status: 200 })
    renderBlock()

    fillRequiredFields()
    submit()

    await waitFor(() => expect(screen.getByText("Thanks for reaching out")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Send it" })).not.toBeInTheDocument()
    // The intro is part of the pre-submission state and goes with the form.
    expect(screen.queryByText("Tell us what you think")).not.toBeInTheDocument()
  })

  it("redirects instead of showing a message when the form is configured that way", async () => {
    mockFetch({ status: 200 })
    renderBlock(buildForm({ confirmationType: "redirect", redirect: { url: "/thanks" } }))

    fillRequiredFields()
    submit()

    await waitFor(() => expect(push).toHaveBeenCalledWith("/thanks"))
  })

  it("surfaces the API's error and keeps the form on screen", async () => {
    mockFetch({
      status: 400,
      body: { errors: [{ message: "That email is blocked" }], status: "400" },
    })
    renderBlock()

    fillRequiredFields()
    submit()

    await waitFor(() => expect(screen.getByText("400: That email is blocked")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Send it" })).toBeInTheDocument()
  })

  it("falls back to a generic error when the API returns no message", async () => {
    mockFetch({ status: 500, body: {} })
    renderBlock()

    fillRequiredFields()
    submit()

    await waitFor(() => expect(screen.getByText("500: Internal Server Error")).toBeInTheDocument())
  })

  it("reports a failed request rather than hanging", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"))
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    renderBlock()

    fillRequiredFields()
    submit()

    await waitFor(() => expect(screen.getByText("500: Something went wrong.")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Send it" })).toBeInTheDocument()
  })
})
