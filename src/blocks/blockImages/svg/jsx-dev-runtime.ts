// The development entry of the runtime in ./jsx-runtime, which dev builds and tests compile to.
import { jsx, type Markup } from "./jsx-runtime"

export { Fragment, type JSX } from "./jsx-runtime"

export function jsxDEV(type: Parameters<typeof jsx>[0], props: Parameters<typeof jsx>[1]): Markup {
  return jsx(type, props)
}
