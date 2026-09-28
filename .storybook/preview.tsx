import { withThemeByClassName } from "@storybook/addon-themes"
import type { Preview } from "@storybook/nextjs-vite"
import { ClientThemeProvider } from "@wrksz/themes/client"
import { unstable_cache } from "next/cache"
import { draftMode } from "next/headers"
import { mocked } from "storybook/test"

import { fontVariables } from "../src/app/(frontend)/fonts"
import "../src/app/(frontend)/globals.css"

// The site sets the font variables on <html>, and globals.css reads them from
// there, so a wrapper element would leave `html { font-sans }` unresolved.
document.documentElement.classList.add(...fontVariables.split(" "))

const preview: Preview = {
  // The framework mocks next/cache with a pass-through `unstable_cache`, but the
  // reset Storybook runs between stories drops that implementation. Its
  // `draftMode` only spies on Next's, which throws outside a request.
  beforeEach: () => {
    mocked(unstable_cache).mockImplementation((cb) => cb)
    mocked(draftMode).mockResolvedValue({
      isEnabled: false,
      enable: () => undefined,
      disable: () => undefined,
    } as Awaited<ReturnType<typeof draftMode>>)
  },
  decorators: [
    (Story, { globals, parameters }) =>
      parameters.ownThemeProvider ? (
        <Story />
      ) : (
        <ClientThemeProvider attribute="class" forcedTheme={globals.theme || "light"}>
          <Story />
        </ClientThemeProvider>
      ),
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
    }),
  ],
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Axe violations fail the story's test. Mark a story `a11y: { test: "todo" }`
      // only while an issue tracks the fix.
      test: "error",
      // Base UI's focus guards are aria-hidden on purpose: they only bounce Tab
      // back into an open popup.
      context: { include: ["body"], exclude: ["[data-base-ui-focus-guard]"] },
    },
  },
  tags: ["autodocs"],
}

export default preview
