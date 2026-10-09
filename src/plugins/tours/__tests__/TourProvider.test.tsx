import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  // Next's router is the same object on every render.
  return { pathname: "/admin", search: "", push, replace, router: { push, replace } }
})
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => nav.router,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const { showStep, remove } = vi.hoisted(() => ({ showStep: vi.fn(), remove: vi.fn() }))
vi.mock("../showStep", () => ({ showStep }))

import { PROGRESS_KEY } from "../steps"
import { TourProvider } from "../TourProvider"

interface StepOptions {
  index: number
  onNext: () => void
  onClose: () => void
}
const lastStep = (): StepOptions => showStep.mock.calls.at(-1)![0] as StepOptions

const stored = () => JSON.parse(window.sessionStorage.getItem(PROGRESS_KEY) ?? "null")

const renderAt = (pathname: string, search = "") => {
  nav.pathname = pathname
  nav.search = search
  return render(
    <TourProvider>
      <p>admin</p>
    </TourProvider>,
  )
}

const rerenderAt = (view: ReturnType<typeof render>, pathname: string, search = "") => {
  nav.pathname = pathname
  nav.search = search
  view.rerender(
    <TourProvider>
      <p>admin</p>
    </TourProvider>,
  )
}

beforeEach(() => {
  showStep.mockReturnValue(remove)
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="card-articles"></div><table><tbody><tr><td><a href="/admin/collections/articles/20">An article</a></td></tr></tbody></table>`,
  )
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
  window.sessionStorage.clear()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe("TourProvider", () => {
  it("starts a tour from ?tour=, drops the parameter, and shows its first step", async () => {
    const view = renderAt("/admin", "tour=articles")
    expect(nav.replace).toHaveBeenCalledWith("/admin")
    expect(stored()).toEqual({ key: "articles", step: 0 })
    expect(showStep).not.toHaveBeenCalled()

    rerenderAt(view, "/admin")
    await waitFor(() => expect(showStep).toHaveBeenCalledOnce())
    expect(lastStep().index).toBe(0)
  })

  it("ignores a tour that doesn't exist", () => {
    renderAt("/admin", "tour=nope&limit=10")
    expect(nav.replace).toHaveBeenCalledWith("/admin?limit=10")
    expect(stored()).toBeNull()
  })

  it("opens the next step's page, and carries on there", async () => {
    const view = renderAt("/admin", "tour=articles")
    rerenderAt(view, "/admin")
    await waitFor(() => expect(showStep).toHaveBeenCalledOnce())

    act(() => lastStep().onNext())
    expect(remove).toHaveBeenCalled()
    expect(nav.push).toHaveBeenCalledWith("/admin/collections/articles")

    document.body.insertAdjacentHTML("beforeend", `<div class="list-header__title-actions"></div>`)
    rerenderAt(view, "/admin/collections/articles")
    await waitFor(() => expect(lastStep().index).toBe(1))
  })

  it("follows a step's link with Next, then moves on when its page loads", async () => {
    window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ key: "articles", step: 3 }))
    const view = renderAt("/admin/collections/articles")
    await waitFor(() => expect(lastStep().index).toBe(3))

    act(() => lastStep().onNext())
    expect(nav.push).toHaveBeenCalledWith("/admin/collections/articles/20")

    document.body.insertAdjacentHTML("beforeend", `<div class="tabs-field__tabs"></div>`)
    rerenderAt(view, "/admin/collections/articles/20")
    await waitFor(() => expect(lastStep().index).toBe(4))
    expect(stored()).toEqual({ key: "articles", step: 4 })
  })

  it("ends when the reader leaves for a page the tour doesn't cover", async () => {
    window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ key: "articles", step: 1 }))
    document.body.insertAdjacentHTML("beforeend", `<div class="list-header__title-actions"></div>`)
    const view = renderAt("/admin/collections/articles")
    await waitFor(() => expect(lastStep().index).toBe(1))

    rerenderAt(view, "/admin/collections/media")
    await waitFor(() => expect(stored()).toBeNull())
    expect(nav.push).not.toHaveBeenCalled()
  })

  it("ends quietly when a step's element never appears", async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ key: "articles", step: 2 }))
    renderAt("/admin/collections/articles")

    await act(() => vi.advanceTimersByTimeAsync(11_000))
    expect(showStep).not.toHaveBeenCalled()
    expect(stored()).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(".search-bar"))
  })

  it("forgets the tour when it's closed", async () => {
    window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ key: "articles", step: 0 }))
    renderAt("/admin")
    await waitFor(() => expect(showStep).toHaveBeenCalled())

    act(() => lastStep().onClose())
    expect(stored()).toBeNull()
  })
})
