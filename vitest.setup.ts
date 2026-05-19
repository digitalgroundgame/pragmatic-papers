// Add global test setup here (e.g. @testing-library/jest-dom matchers)

// Load .env files
import "dotenv/config"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
  cleanup()
})
