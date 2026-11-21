export interface ThemeValues {
  light: Record<string, string>
  dark: Record<string, string>
}

const BLOCK = /(^|\n)(:root|\.dark)\s*\{([^}]*)\}/g
const DECLARATION = /--([\w-]+)\s*:\s*([^;]+);/g

function declarations(body: string): Record<string, string> {
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "")
  return Object.fromEntries(
    [...withoutComments.matchAll(DECLARATION)].map(([, name, value]) => [
      name,
      (value ?? "").trim(),
    ]),
  )
}

/**
 * The custom properties globals.css sets on `:root` (light) and `.dark`, as written. A
 * property `.dark` doesn't set keeps its light value, as in the browser. Only top-level blocks
 * whose selector is exactly `:root` or `.dark` count: `:root:has(…)` and the copies inside
 * media queries (indented, as Prettier writes them) only adjust values at runtime.
 */
export function parseThemes(css: string): ThemeValues {
  const light: Record<string, string> = {}
  const darkOverrides: Record<string, string> = {}
  for (const [, , selector, body] of css.matchAll(BLOCK)) {
    Object.assign(selector === ":root" ? light : darkOverrides, declarations(body ?? ""))
  }
  return { light, dark: { ...light, ...darkOverrides } }
}
