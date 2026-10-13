import { afterEach, describe, expect, it } from "vitest"

import { bindPauseSwitch, TICKER_PAUSED_KEY } from "../pause"

/** A pause switch, bound as the ticker binds it when it mounts. */
function render(): HTMLInputElement {
  const input = document.createElement("input")
  input.type = "checkbox"
  document.body.append(input)
  bindPauseSwitch(input)
  return input
}

afterEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
})

describe("the ticker's pause switch", () => {
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

  it("stops remembering once it's unbound", () => {
    const input = document.createElement("input")
    input.type = "checkbox"
    document.body.append(input)
    bindPauseSwitch(input)()
    input.click()
    expect(localStorage.getItem(TICKER_PAUSED_KEY)).toBeNull()
  })

  it("does nothing when storage is blocked", () => {
    const { getItem, setItem } = Storage.prototype
    Storage.prototype.getItem = () => {
      throw new Error("SecurityError")
    }
    Storage.prototype.setItem = () => {
      throw new Error("SecurityError")
    }
    try {
      const input = render()
      expect(input).not.toBeChecked()
      input.click()
      expect(input).toBeChecked()
    } finally {
      Storage.prototype.getItem = getItem
      Storage.prototype.setItem = setItem
    }
  })
})
