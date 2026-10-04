"use client"

import { MathJax, MathJaxBaseContext } from "better-react-mathjax/esm"
import React, { useContext, useEffect, useState } from "react"

export interface TypesetMathProps {
  inline?: boolean
  children: React.ReactNode
}

// `<MathJax>` chains a `.catch` that re-throws onto the script's load promise
// the moment it mounts, so if cdnjs is unreachable every formula on the page
// raises its own unhandled "Typesetting failed" rejection. Hand it the
// formula only once MathJax has loaded; until then, and for good if it never
// does, readers get the raw TeX. The provider's `onError` reports the failure.
export const TypesetMath: React.FC<TypesetMathProps> = ({ inline = false, children }) => {
  const mathJax = useContext(MathJaxBaseContext)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!mathJax) return
    let mounted = true
    mathJax.promise.then(
      () => {
        if (mounted) setLoaded(true)
      },
      () => {
        // Reported once by MathJaxProvider's `onError`; stay on the raw TeX.
      },
    )
    return () => {
      mounted = false
    }
  }, [mathJax])

  if (loaded) return <MathJax inline={inline}>{children}</MathJax>

  return <span style={{ display: inline ? "inline" : "block" }}>{children}</span>
}
