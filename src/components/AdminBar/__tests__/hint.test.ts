import { afterEach, describe, expect, it } from "vitest"

import {
  ADMIN_BAR_ATTRIBUTE,
  ADMIN_BAR_HINT_KEY,
  ADMIN_BAR_HINT_SCRIPT,
  readAdminBarHint,
  writeAdminBarHint,
} from "../hint"

const runHintScript = () => new Function(ADMIN_BAR_HINT_SCRIPT)()

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute(ADMIN_BAR_ATTRIBUTE)
})

describe("admin bar hint", () => {
  it("marks <html> before paint when the last page saw someone logged in", () => {
    localStorage.setItem(ADMIN_BAR_HINT_KEY, "1")
    runHintScript()
    expect(document.documentElement).toHaveAttribute(ADMIN_BAR_ATTRIBUTE)
  })

  it("leaves <html> alone for a reader", () => {
    runHintScript()
    expect(document.documentElement).not.toHaveAttribute(ADMIN_BAR_ATTRIBUTE)
  })

  it("round-trips through storage and the attribute", () => {
    writeAdminBarHint(true)
    expect(readAdminBarHint()).toBe(true)
    expect(document.documentElement).toHaveAttribute(ADMIN_BAR_ATTRIBUTE)
    writeAdminBarHint(false)
    expect(readAdminBarHint()).toBe(false)
    expect(document.documentElement).not.toHaveAttribute(ADMIN_BAR_ATTRIBUTE)
  })
})
