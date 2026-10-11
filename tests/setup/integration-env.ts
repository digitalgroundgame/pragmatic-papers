// The integration project's counterpart to vitest.setup.ts, which it used to share. That
// file registers jest-dom's matchers, Testing Library's cleanup and jsdom stubs, none of
// which a node-environment test touches, and loading them cost every integration file
// ~0.5s of imports. All an integration file needs from it is `.env`.
import "dotenv/config"
