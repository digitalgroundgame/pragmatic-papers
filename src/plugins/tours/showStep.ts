import { driver } from "driver.js"
import "driver.js/dist/driver.css"

import "./tours.css"
import { canGoBack } from "./steps"
import type { Tour } from "./types"

interface ShowStepOptions {
  tour: Tour
  index: number
  element?: Element
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

/**
 * Shows one step of `tour` with driver.js. Imported only when a tour is running, so the admin's
 * first load doesn't carry it. The provider decides what Next and Previous do, since they can
 * change the page. Returns a function that removes the popover without counting as a close.
 */
export function showStep({
  tour,
  index,
  element,
  onNext,
  onPrevious,
  onClose,
}: ShowStepOptions): () => void {
  let removing = false
  const tourDriver = driver({
    animate: true,
    allowClose: true,
    overlayClickBehavior: "none",
    popoverClass: "pp-tour",
    showProgress: tour.steps.length > 1,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    closeBtnLabel: "End the tour",
    // Every step, so the progress reads "4 of 8"; only this one is shown.
    steps: tour.steps.map((each, i) => ({
      element: i === index ? element : undefined,
      popover: {
        title: each.title,
        description: each.description,
        side: each.side,
        showButtons: canGoBack(tour, i) ? ["next", "previous", "close"] : ["next", "close"],
      },
    })),
    onNextClick: () => onNext(),
    onPrevClick: () => onPrevious(),
    onDestroyStarted: () => {
      if (!removing) onClose()
      tourDriver.destroy()
    },
  })
  tourDriver.drive(index)

  return () => {
    removing = true
    tourDriver.destroy()
  }
}
