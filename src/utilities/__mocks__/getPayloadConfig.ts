import { fn } from "storybook/test"

import { createFakePayload } from "@/stories/fixtures/payload"

// Storybook's stand-in (`sb.mock` in .storybook/preview.tsx). Stories seed data
// with `mocked(getPayloadConfig).mockResolvedValue(createFakePayload({...}))`.
export const getPayloadConfig = fn(async () => createFakePayload()).mockName("getPayloadConfig")
