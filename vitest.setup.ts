// Add global test setup here (e.g. @testing-library/jest-dom matchers)

// Load .env files
import "dotenv/config"

// Disable Payload's Drizzle schema push — tests run migrations explicitly
process.env.PAYLOAD_PUSH_SCHEMA = "false"
