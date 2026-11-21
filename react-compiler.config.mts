import babel from "@rolldown/plugin-babel"
import { reactCompilerPreset } from "@vitejs/plugin-react"
import type { Plugin } from "vite"

/**
 * The React Compiler for Vitest and Storybook, applied where next build applies it
 * (`reactCompiler` in next.config.ts): to client code. Next compiles only the browser bundle,
 * so a server component runs as written, and the unit tests that call one as a plain function
 * would fail on the compiler's cache hook outside a render. Client code here means a module
 * that starts with "use client", which every component and hook with state does.
 */
export function clientReactCompiler(): Plugin {
  const preset = reactCompilerPreset()
  preset.rolldown.filter = {
    ...preset.rolldown.filter,
    code: /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/,
  }
  return babel({ presets: [preset] }) as Plugin
}
