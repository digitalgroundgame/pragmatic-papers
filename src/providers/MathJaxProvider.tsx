"use client"

import dynamic from "next/dynamic"

import { captureMessage } from "@/sentryClient"

const MathJaxContext = dynamic(
  () => import("better-react-mathjax").then((mod) => mod.MathJaxContext),
  {
    ssr: true,
  },
)

// Without `onError` the library re-throws a failed script load as an unhandled
// rejection. Readers behind a blocker or a filtered network will always hit
// that sometimes, so report it once as a handled warning and let `TypesetMath`
// leave the raw TeX in place.
const reportLoadFailure = (error: unknown) => {
  captureMessage("MathJax failed to load", { level: "warning", extra: { error } })
}

// MathJax's default is to typeset the whole document as soon as it loads,
// which can rewrite a formula's server-rendered TeX before React hydrates it
// Every formula is its own `<MathJax>` element that typesets itself,
// so the page-wide pass only duplicates that work, and turning it off also
// leaves stray `\(`/`\[` in article text and embeds untouched.
const config = { startup: { typeset: false } }

export const MathJaxProviderRoot: React.FC<{
  children?: React.ReactNode
}> = ({ children }) => {
  return (
    <MathJaxContext version={3} config={config} onError={reportLoadFailure}>
      {children}
    </MathJaxContext>
  )
}

export const MathJaxProvider: React.FC<{
  enableMathRendering: boolean | null | undefined
  children: React.ReactNode
}> = ({ enableMathRendering, children }) => {
  if (!enableMathRendering) return children
  return <MathJaxProviderRoot>{children}</MathJaxProviderRoot>
}
