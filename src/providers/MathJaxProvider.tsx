import dynamic from "next/dynamic"

const MathJaxContext = dynamic(
  () => import("better-react-mathjax").then((mod) => mod.MathJaxContext),
  {
    ssr: true,
  },
)

export const MathJaxProviderRoot: React.FC<{
  children?: React.ReactNode
}> = ({ children }) => {
  return <MathJaxContext version={3}>{children}</MathJaxContext>
}

export const MathJaxProvider: React.FC<{
  enableMathRendering: boolean | null | undefined
  children: React.ReactNode
}> = ({ enableMathRendering, children }) => {
  if (!enableMathRendering) return children
  return <MathJaxProviderRoot>{children}</MathJaxProviderRoot>
}
