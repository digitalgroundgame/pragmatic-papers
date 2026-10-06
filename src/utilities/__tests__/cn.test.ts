import { describe, expect, it } from "vitest"

import { cn } from "../utils"

// Expected values are what twMerge(clsx(...)) produced before the switch to
// the `cn` package, so a release that changes merge rules fails here by name.
describe("cn", () => {
  it.each([
    ["px-2 py-1", "p-3", "p-3"],
    ["p-3", "px-2", "p-3 px-2"],
    ["text-sm", "text-red-500", "text-sm text-red-500"],
    ["text-[14px]", "text-lg", "text-lg"],
    ["hover:bg-red-500", "hover:bg-blue-500", "hover:bg-blue-500"],
    ["!p-2", "p-4", "!p-2 p-4"],
    ["-mt-2", "mt-4", "mt-4"],
    ["size-5", "h-4", "size-5 h-4"],
    ["rounded-md", "rounded-t-none", "rounded-md rounded-t-none"],
    ["grid-cols-2", "grid-cols-[1fr_auto]", "grid-cols-[1fr_auto]"],
    ["font-sans", "font-bold", "font-sans font-bold"],
    ["data-[state=open]:bg-accent", "data-[state=open]:bg-muted", "data-[state=open]:bg-muted"],
    ["[&>svg]:size-4", "[&>svg]:size-5", "[&>svg]:size-5"],
    ["text-foreground/80", "text-muted-foreground", "text-muted-foreground"],
    ["dark:scale-0 dark:rotate-90", "dark:scale-100", "dark:rotate-90 dark:scale-100"],
  ])("cn(%j, %j) → %j", (base, override, expected) => {
    expect(cn(base, override)).toBe(expected)
  })

  it("drops falsy values and flattens objects and arrays", () => {
    expect(cn("a", false, null, undefined, 0, "", { b: true, c: false }, ["d", ["e"]])).toBe(
      "a b d e",
    )
  })
})
