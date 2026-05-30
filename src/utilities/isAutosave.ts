import type { PayloadRequest } from "payload"

export function isAutosave(req: PayloadRequest): boolean {
  const autosaveQuery = req?.query?.autosave
  return (
    autosaveQuery === true ||
    autosaveQuery === "true" ||
    autosaveQuery === 1 ||
    autosaveQuery === "1"
  )
}
