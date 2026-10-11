import { afterEach, describe, expect, it } from "vitest"

import { TICKER_PAUSE_SCRIPT, TICKER_PAUSED_KEY } from "../pause"

/** The switch and its script as the page has them, with the script run as the parser would. */
function render(): HTMLInputElement {
  const input = document.createElement("input")
  input.type = "checkbox"
  const script = document.createElement("script")
  document.body.append(input, script)
  Object.defineProperty(document, "currentScript", { value: script, configurable: true })
  new Function(TICKER_PAUSE_SCRIPT)()
  return input
}

afterEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
})

describe("the ticker's pause script", () => {
  it("leaves the ticker running for a reader who never paused it", () => {
    expect(render()).not.toBeChecked()
  })

  it("keeps it paused for a reader who paused it on an earlier page", () => {
    localStorage.setItem(TICKER_PAUSED_KEY, "1")
    expect(render()).toBeChecked()
  })

  it("remembers each change to the switch", () => {
    const input = render()
    input.click()
    expect(localStorage.getItem(TICKER_PAUSED_KEY)).toBe("1")
    input.click()
    expect(localStorage.getItem(TICKER_PAUSED_KEY)).toBeNull()
  })

  it("does nothing when storage is blocked", () => {
    const { getItem } = Storage.prototype
    Storage.prototype.getItem = () => {
      throw new Error("SecurityError")
    }
    try {
      expect(render()).not.toBeChecked()
    } finally {
      Storage.prototype.getItem = getItem
    }
  })
})
