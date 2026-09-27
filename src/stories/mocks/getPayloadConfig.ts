import { fn } from "storybook/test"

import { createFakePayload } from "@/stories/fixtures/payload"

// Storybook's stand-in, swapped in by .storybook/main.ts. Stories seed data with
// `mocked(getPayloadConfig).mockResolvedValue(createFakePayload({...}))`.
export const getPayloadConfig = fn(async () => createFakePayload()).mockName("getPayloadConfig")
