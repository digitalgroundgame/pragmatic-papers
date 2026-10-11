import { fn } from "storybook/test"

import { createFakePayload } from "@/stories/fixtures/payload"

// Storybook's stand-in, swapped in by .storybook/main.ts. Stories seed data with
// `mocked(getPayloadClient).mockResolvedValue(createFakePayload({...}))`.
export const getPayloadClient = fn(async () => createFakePayload()).mockName("getPayloadClient")
