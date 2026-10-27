/** Set in localStorage while a reader has the ticker paused, so it stays paused on the next page. */
export const TICKER_PAUSED_KEY = "pp:ticker-paused"

/**
 * Ticks the pause switch when the reader paused the ticker last time, and records each change.
 * The pause switch calls it as it mounts, before the ticker paints, so a reader who paused it
 * never sees it move or stick. Private mode and blocked site data can make localStorage throw,
 * which reads as not paused. Returns the cleanup that stops recording.
 */
export function bindPauseSwitch(input: HTMLInputElement): () => void {
  try {
    input.checked = localStorage.getItem(TICKER_PAUSED_KEY) === "1"
  } catch {
    input.checked = false
  }
  const record = (): void => {
    try {
      if (input.checked) localStorage.setItem(TICKER_PAUSED_KEY, "1")
      else localStorage.removeItem(TICKER_PAUSED_KEY)
    } catch {
      // Not remembered, but the switch still works on this page.
    }
  }
  input.addEventListener("change", record)
  return () => input.removeEventListener("change", record)
}
