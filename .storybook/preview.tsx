import { withThemeByClassName } from "@storybook/addon-themes"
import type { Preview } from "@storybook/nextjs-vite"

import { fontVariables } from "../src/app/(frontend)/fonts"
import "../src/app/(frontend)/globals.css"

// The site sets the font variables on <html>, and globals.css reads them from
// there, so a wrapper element would leave `html { font-sans }` unresolved.
document.documentElement.classList.add(...fontVariables.split(" "))

const preview: Preview = {
  decorators: [
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
    },
  },
  tags: ["autodocs"],
}

export default preview
