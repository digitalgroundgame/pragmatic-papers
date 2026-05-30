import { type Volume } from "@/payload-types"
import { toRoman } from "@/utilities/toRoman"
import { type CollectionBeforeChangeHook } from "payload"

export const setDefaultSeoTitle: CollectionBeforeChangeHook<Volume> = ({ data }) => {
  if (data.meta && data.volumeNumber) {
    const defaultTitle = `Volume ${toRoman(Number(data.volumeNumber))} | The Pragmatic Papers`
    data.meta.title = data.meta.title ? data.meta.title : defaultTitle
  }
  return data
}
