import { fireEvent, screen } from "@testing-library/react"

/**
 * Base UI's Select is a button plus a portalled listbox, not a native
 * `<select>`, so jsdom needs the event sequence a real pointer produces: the
 * trigger opens on pointerdown/up, and an item only commits once it is the
 * highlighted one — hence the `mouseMove` before the press.
 */
export async function chooseOption(trigger: HTMLElement, optionName: string): Promise<void> {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.pointerUp(trigger, { button: 0 })
  fireEvent.click(trigger)

  const option = await screen.findByRole("option", { name: optionName })

  fireEvent.mouseMove(option)
  fireEvent.mouseDown(option)
  fireEvent.mouseUp(option)
  fireEvent.click(option)
}
