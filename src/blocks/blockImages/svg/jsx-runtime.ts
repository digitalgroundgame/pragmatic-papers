/**
 * A JSX runtime that builds SVG markup as a string, for the block picker's drawings. A file
 * opts in with `/** @jsxImportSource @/blocks/blockImages/svg *\/`. It isn't React: the
 * drawings are served by a route handler, where Next refuses `react-dom/server` and
 * lucide-react's icons are client components, so React can't turn them into a file there.
 *
 * Elements render as `<tag attr="…">children</tag>`, with camelCase attributes written in
 * kebab-case as React writes them for SVG (`strokeWidth` → `stroke-width`), and every
 * attribute value and text child escaped.
 */

/** Markup this runtime built, so it's nested as is rather than escaped as text. */
export class Markup {
  constructor(readonly html: string) {}
  toString(): string {
    return this.html
  }
}

export type Child = Markup | string | number | boolean | null | undefined | Child[]

type Props = Record<string, unknown> & { children?: Child }
type Component = (props: never) => Markup

/** Attributes SVG spells in camelCase. */
const CAMEL_CASE = new Set(["viewBox"])

const escape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")

const attributeName = (name: string): string =>
  name === "className"
    ? "class"
    : CAMEL_CASE.has(name)
      ? name
      : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

function renderChild(child: Child): string {
  if (child instanceof Markup) return child.html
  if (Array.isArray(child)) return child.map(renderChild).join("")
  if (child === null || child === undefined || typeof child === "boolean") return ""
  return escape(String(child))
}

export function Fragment({ children }: { children?: Child }): Markup {
  return new Markup(renderChild(children))
}

export function jsx(type: string | Component, props: Props, _key?: unknown): Markup {
  if (typeof type === "function") return (type as (props: Props) => Markup)(props)
  const { children, ...attributes } = props
  const rendered = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([name, value]) => ` ${attributeName(name)}="${escape(String(value))}"`)
    .join("")
  return new Markup(`<${type}${rendered}>${renderChild(children)}</${type}>`)
}

export const jsxs = jsx

// eslint-disable-next-line @typescript-eslint/no-namespace -- TypeScript reads JSX types from here
export namespace JSX {
  export type Element = Markup
  export interface IntrinsicElements {
    [tag: string]: Record<string, unknown> & { children?: Child }
  }
  /** Lists of elements may carry React's `key`; this runtime has no use for it. */
  export interface IntrinsicAttributes {
    key?: string | number
  }
  export interface ElementChildrenAttribute {
    children: unknown
  }
}
